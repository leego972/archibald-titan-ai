import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import LeegoLogo from "@/components/LeegoLogo";
import { useIsMobile } from "@/hooks/useMobile";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TitanLogo } from "@/components/TitanLogo";
import { AT_ICON_FULL } from "@/lib/logos";
import AffiliateRecommendations from "@/components/AffiliateRecommendations";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Send,
  User,
  Trash2,
  Activity,
  Wrench,
  Shield,
  Lock,
  Download,
  Timer,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageSquare,
  Search,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Trash,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Navigation,
  Code2,
  KeyRound,
  Globe,
  Users,
  Calendar,
  Cpu,
  Mic,
  MicOff,
  Square,
  Terminal,
  Settings,
  ScanLine,
  Hammer,
  LayoutDashboard,
  RefreshCw,
  Eraser,
  FilePlus,
  Paperclip,
  X,
  StopCircle,
  Crown,
  Eye,
  FileCode,
  SearchCode,
  BookOpen,
  Copy,
  Check,
  RotateCcw,
  ArrowDown,
  Menu,
  DollarSign,
  Rocket,
  TrendingUp,
  Banknote,
  HandCoins,
  Target,
  FolderOpen,
  FileText,
  ExternalLink,
  Key,
  Save,
  Monitor,
  Apple,
  Smartphone,
  Volume2,
  VolumeX,
  AudioLines,
  PhoneOff,
  Bug,
  Crosshair,
  ScanSearch,
  Clock,
  ListX,
  Hourglass,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Slash Commands ────────────────────────────────────────────────
interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: 'send' | 'navigate' | 'local';
  prompt?: string;
  path?: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/help', label: 'Help', description: 'Show all capabilities', icon: <HelpCircle className="h-4 w-4" />, action: 'local' },
  { command: '/build', label: 'Build', description: 'Build a new feature or page', icon: <Hammer className="h-4 w-4" />, action: 'send', prompt: 'I want to build a new feature. What would you like me to create? Please describe what you need.' },
  { command: '/scan', label: 'Scan', description: 'Scan for leaked credentials', icon: <ScanLine className="h-4 w-4" />, action: 'send', prompt: 'Run a full credential leak scan across all my stored credentials and report any findings.' },
  { command: '/status', label: 'Status', description: 'Check system health', icon: <Activity className="h-4 w-4" />, action: 'send', prompt: 'Run a full system health check — check server status, database connectivity, and all services.' },
  { command: '/credentials', label: 'Credentials', description: 'Go to credentials vault', icon: <KeyRound className="h-4 w-4" />, action: 'navigate', path: '/fetcher/credentials' },
  { command: '/settings', label: 'Settings', description: 'Go to account settings', icon: <Settings className="h-4 w-4" />, action: 'navigate', path: '/fetcher/account' },
  { command: '/dashboard', label: 'Dashboard', description: 'Go to main dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: 'navigate', path: '/dashboard' },
  { command: '/leaks', label: 'Leak Scanner', description: 'Go to leak scanner', icon: <Shield className="h-4 w-4" />, action: 'navigate', path: '/fetcher/leak-scanner' },
  { command: '/team', label: 'Team', description: 'Go to team management', icon: <Users className="h-4 w-4" />, action: 'navigate', path: '/fetcher/team' },
  { command: '/sync', label: 'Auto-Sync', description: 'Go to auto-sync settings', icon: <RefreshCw className="h-4 w-4" />, action: 'navigate', path: '/fetcher/auto-sync' },
  { command: '/new', label: 'New Chat', description: 'Start a new conversation', icon: <FilePlus className="h-4 w-4" />, action: 'local' },
  { command: '/clear', label: 'Clear', description: 'Clear current chat', icon: <Eraser className="h-4 w-4" />, action: 'local' },
];

// ─── Help Categories ──────────────────────────────────────────────
const HELP_CATEGORIES = [
  {
    icon: "code2",
    title: "Build & Deploy Software",
    items: [
      "Build entire apps, features, and pages from scratch",
      "Modify existing code across multiple files",
      "Run TypeScript type checks and fix errors",
      "Execute test suites and debug failures",
      "Health check the system and restart services",
      "Roll back changes if something breaks",
    ],
  },
  {
    icon: "keyrnd",
    title: "Credential Management",
    items: [
      "List, reveal, and export saved credentials",
      "Create and manage API keys",
      "Trigger credential fetch jobs from 15+ providers",
      "Bulk sync all credentials at once",
      "Check provider health and availability",
    ],
  },
  {
    icon: "shield",
    title: "Security & Protection",
    items: [
      "Scan for leaked credentials on the dark web",
      "Set up two-factor authentication (2FA)",
      "View audit logs of all actions",
      "Manage vault entries securely",
    ],
  },
  {
    icon: "globe",
    title: "Web Research",
    items: [
      "Search the web for any information",
      "Read and extract content from web pages",
      "Research APIs, documentation, and guides",
    ],
  },
  {
    icon: "navigation",
    title: "App Navigation",
    items: [
      'Navigate to any page — just say "take me to..."',
      "2FA Setup → /fetcher/account",
      "Credentials → /fetcher/credentials",
      "Auto-Sync → /fetcher/auto-sync",
      "Leak Scanner → /fetcher/leak-scanner",
      "Site Monitor → /site-monitor",
      "Team Management → /fetcher/team",
      "Pricing → /pricing",
    ],
  },
  {
    icon: "users",
    title: "Team & Admin",
    items: [
      "Add, remove, and manage team members",
      "Update member roles and permissions",
      "View system status and plan usage",
      "Get AI-powered recommendations",
    ],
  },
  {
    icon: "calendar",
    title: "Automation & Scheduling",
    items: [
      "Create and manage scheduled fetch jobs",
      "Set up auto-sync with custom intervals",
      "Configure watchdog monitoring",
    ],
  },
  {
    icon: "activity",
    title: "Website Health Monitor",
    items: [
      "Monitor website uptime and response times",
      "Track SSL certificate expiry and errors",
      "Auto-repair via Railway, Vercel, SSH, and more",
      "View incidents and repair logs",
      "Site Monitor → /site-monitor",
    ],
  },
];

const HELP_ICONS: Record<string, React.ReactNode> = {
  code2: <Code2 className="h-4 w-4" />,
  keyrnd: <KeyRound className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
  navigation: <Navigation className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
};

const QUICK_ACTION_ICONS: Record<string, React.ReactNode> = {
  activity: <Activity className="h-4 w-4" />,
  wrench: <Wrench className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  lock: <Lock className="h-4 w-4" />,
  download: <Download className="h-4 w-4" />,
  timer: <Timer className="h-4 w-4" />,
};

const TOOL_LABELS: Record<string, string> = {
  list_credentials: "Listed credentials",
  reveal_credential: "Revealed credential",
  export_credentials: "Exported credentials",
  create_fetch_job: "Created fetch job",
  list_jobs: "Listed fetch jobs",
  get_job_details: "Fetched job details",
  list_providers: "Listed providers",
  list_api_keys: "Listed API keys",
  create_api_key: "Created API key",
  revoke_api_key: "Revoked API key",
  start_leak_scan: "Started leak scan",
  get_leak_scan_results: "Fetched scan results",
  list_vault_entries: "Listed vault entries",
  add_vault_entry: "Added vault entry",
  trigger_bulk_sync: "Triggered bulk sync",
  get_bulk_sync_status: "Fetched sync status",
  list_team_members: "Listed team members",
  add_team_member: "Added team member",
  remove_team_member: "Removed team member",
  update_team_member_role: "Updated member role",
  list_schedules: "Listed schedules",
  create_schedule: "Created schedule",
  delete_schedule: "Deleted schedule",
  get_watchdog_summary: "Fetched watchdog summary",
  check_provider_health: "Checked provider health",
  get_recommendations: "Fetched recommendations",
  get_audit_logs: "Fetched audit logs",
  get_system_status: "Fetched system status",
  get_plan_usage: "Fetched plan usage",
  self_read_file: "Read file",
  self_list_files: "Listed files",
  self_modify_file: "Modified file",
  self_health_check: "Health check",
  self_rollback: "Rolled back",
  self_restart: "Restarted service",
  self_modification_history: "Modification history",
  self_get_protected_files: "Protected files list",
  self_type_check: "Type checked",
  self_run_tests: "Ran tests",
  self_multi_file_modify: "Modified multiple files",
  navigate_to_page: "Navigated to page",
  web_search: "Searched the web",
  web_page_read: "Read web page",
};

interface ExecutedAction {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
}

interface ChatAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  actionsTaken?: Array<{ tool: string; success: boolean; summary: string }> | null;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }> | null;
}

// ─── Copy Button ────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent/80 text-muted-foreground hover:text-foreground"
      title="Copy message"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Action Badges ──────────────────────────────────────────────────
function ActionBadges({
  actions,
}: {
  actions: Array<{ tool: string; success: boolean; summary: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (actions.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Zap className="h-3 w-3 text-amber-400" />
        <span className="font-medium">
          {actions.length} action{actions.length > 1 ? "s" : ""} executed
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {actions.map((action, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-[11px] pl-4 py-0.5"
            >
              {action.success ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-400 shrink-0" />
              )}
              <span className="text-muted-foreground">
                {TOOL_LABELS[action.tool] || action.tool}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Help Panel ─────────────────────────────────────────────────────
function HelpPanel({ onTryCommand }: { onTryCommand: (cmd: string) => void }) {
  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Welcome to Titan — What I Can Do</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        I'm your AI-powered builder and operations assistant. Here's everything I can help with:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {HELP_CATEGORIES.map((cat) => (
          <div
            key={cat.title}
            className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="text-primary">{HELP_ICONS[cat.icon] || <Cpu className="h-4 w-4" />}</div>
              <h4 className="text-sm font-semibold">{cat.title}</h4>
            </div>
            <ul className="space-y-1">
              {cat.items.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary/60 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border/30">
        <p className="text-xs text-muted-foreground mb-2">Try these commands:</p>
        <div className="flex flex-wrap gap-2">
          {[
            "List my credentials",
            "Set up 2FA",
            "Scan for leaks",
            "Build me a new page",
            "Check system health",
          ].map((cmd) => (
            <button
              key={cmd}
              onClick={() => onTryCommand(cmd)}
              className="text-xs px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-accent/50 transition-colors text-foreground"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Conversation Sidebar (Desktop) ────────────────────────────────
function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  onDelete,
  collapsed,
  onToggle,
}: {
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete?: (id: number) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data: convData, refetch } = trpc.chat.listConversations.useQuery(
    search ? { search } : undefined,
    { refetchOnWindowFocus: false }
  );

  const renameMutation = trpc.chat.renameConversation.useMutation({
    onSuccess: () => { refetch(); setEditingId(null); },
  });
  const deleteMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: (_data, variables) => {
      refetch();
      toast.success("Conversation deleted");
      setConfirmDeleteId(null);
      // Always notify parent of deletion
      if (onDelete) {
        onDelete(variables.conversationId);
      }
    },
  });
  const pinMutation = trpc.chat.pinConversation.useMutation({
    onSuccess: () => refetch(),
  });
  const archiveMutation = trpc.chat.archiveConversation.useMutation({
    onSuccess: () => { refetch(); toast.success("Conversation archived"); },
  });

  const conversations = convData?.conversations ?? [];

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border/50 flex flex-col items-center py-3 gap-2 shrink-0 bg-background/50">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <button
          onClick={onNew}
          className="p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border/50 flex flex-col shrink-0 bg-background/50">
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conversations</h3>
        <div className="flex items-center gap-1">
          <button onClick={onNew} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors" title="New conversation">
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors" title="Collapse sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-8 pl-8 text-xs" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {search ? "No conversations found" : "No conversations yet"}
          </div>
        ) : (
          <div className="p-1 space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-foreground"
                }`}
                onClick={() => onSelect(conv.id)}
              >
                {conv.pinned === 1 && <Pin className="h-3 w-3 text-amber-400 shrink-0" />}
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* Confirm delete inline banner */}
                {confirmDeleteId === conv.id ? (
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-destructive font-medium truncate">Delete?</span>
                    <button
                      className="p-1 rounded bg-destructive/20 hover:bg-destructive/40 text-destructive transition-colors shrink-0"
                      title="Confirm delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ conversationId: conv.id });
                        setConfirmDeleteId(null);
                      }}
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                    <button
                      className="p-1 rounded bg-muted/50 hover:bg-muted text-muted-foreground transition-colors shrink-0"
                      title="Cancel"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    {editingId === conv.id ? (
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => {
                          if (editTitle.trim()) {
                            renameMutation.mutate({ conversationId: conv.id, title: editTitle.trim() });
                          }
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editTitle.trim()) {
                            renameMutation.mutate({ conversationId: conv.id, title: editTitle.trim() });
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 text-xs bg-transparent border-b border-primary/50 outline-none"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex-1 text-xs truncate">{conv.title || "New conversation"}</span>
                    )}

                    {/* Delete button — always visible on mobile, hover on desktop */}
                    <button
                      className={`${
                        isMobile
                          ? "opacity-70"
                          : "opacity-0 group-hover:opacity-100"
                      } p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all shrink-0`}
                      title="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(conv.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {/* More options dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`${
                            isMobile
                              ? "opacity-70"
                              : "opacity-0 group-hover:opacity-100"
                          } p-0.5 rounded hover:bg-accent transition-all shrink-0`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => { setEditingId(conv.id); setEditTitle(conv.title || ""); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => pinMutation.mutate({ conversationId: conv.id, pinned: conv.pinned === 1 ? false : true })}>
                          {conv.pinned === 1 ? <><PinOff className="h-3.5 w-3.5 mr-2" /> Unpin</> : <><Pin className="h-3.5 w-3.5 mr-2" /> Pin</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => archiveMutation.mutate({ conversationId: conv.id, archived: true })}>
                          <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmDeleteId(conv.id)} className="text-red-500 focus:text-red-500">
                          <Trash className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground text-center">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Mobile Conversation Drawer ─────────────────────────────────────
function MobileConversationDrawer({
  open,
  onClose,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete?: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: convData } = trpc.chat.listConversations.useQuery(undefined, { refetchOnWindowFocus: false });
  const conversations = convData?.conversations ?? [];
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const deleteMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: (_data, variables) => {
      utils.chat.listConversations.invalidate();
      toast.success("Conversation deleted");
      setConfirmDeleteId(null);
      // Always notify parent of deletion
      if (onDelete) {
        onDelete(variables.conversationId);
      }
    },
  });
  const pinMutation = trpc.chat.pinConversation.useMutation({
    onSuccess: () => utils.chat.listConversations.invalidate(),
  });

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-[280px] bg-background border-r border-border z-50 flex flex-col animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Conversations</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => { onNew(); onClose(); }} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No conversations yet</div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                    activeId === conv.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div
                    className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
                    onClick={() => { onSelect(conv.id); onClose(); }}
                  >
                    {conv.pinned === 1 && <Pin className="h-3 w-3 text-amber-400 shrink-0" />}
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">{conv.title || "New conversation"}</span>
                  </div>
                  {/* Delete button — always visible on mobile */}
                  <button
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all shrink-0"
                    title="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(conv.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-accent transition-all shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => pinMutation.mutate({ conversationId: conv.id, pinned: conv.pinned === 1 ? false : true })}>
                        {conv.pinned === 1 ? <><PinOff className="h-3.5 w-3.5 mr-2" /> Unpin</> : <><Pin className="h-3.5 w-3.5 mr-2" /> Pin</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setConfirmDeleteId(conv.id)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h4 className="text-sm font-semibold mb-2">Delete conversation?</h4>
            <p className="text-xs text-muted-foreground mb-4">This will permanently delete this conversation and all its messages. Your project files, sandbox files, and GitHub repos are <strong>not affected</strong>.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ conversationId: confirmDeleteId })}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Scroll to Bottom Button ────────────────────────────────────────
function ScrollToBottomButton({ scrollRef, isUserScrolledUpRef }: { scrollRef: React.RefObject<HTMLDivElement>; isUserScrolledUpRef: React.MutableRefObject<boolean> }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShow(distFromBottom > 100);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  if (!show) return null;

  return (
    <button
      onClick={() => {
        // Re-pin to bottom and scroll down
        isUserScrolledUpRef.current = false;
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }}
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 h-8 w-8 rounded-full bg-background border border-border shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
      title="Scroll to bottom"
    >
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}


// ─── Main Chat Page ──────────────────────────────────────────────────
export default function ChatPage() {
  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("Thinking...");
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const isProcessingRef = useRef(false);

  // Real-time Streaming State
  interface StreamEvent {
    type: string;
    tool?: string;
    description?: string;
    summary?: string;
    success?: boolean;
    preview?: string;
    message?: string;
    round?: number;
    results?: string[];
    block?: string;
    error?: string;
    reasoning?: boolean;  // true when this is Titan's actual LLM reasoning content
    phase?: string;       // 'build' | 'github' | 'chat'
    timestamp: number;
  }
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [showStreamPanel, setShowStreamPanel] = useState(true);
  const [buildLog, setBuildLog] = useState<StreamEvent[]>([]); // persistent log of all events for the current message
  const [isBuildMode, setIsBuildMode] = useState(false); // true when Titan is using security/builder tools
  const [showBuilderHistory, setShowBuilderHistory] = useState(false); // toggle builder history panel
  const SECURITY_TOOLS = ['install_security_toolkit', 'network_scan', 'generate_yara_rule', 'generate_sigma_rule',
    'hash_crack', 'generate_payload', 'osint_lookup', 'cve_lookup', 'run_exploit', 'decompile_binary', 'fuzzer_run',
    'sandbox_exec', 'sandbox_write_file', 'create_file', 'provide_project_zip', 'eas_build'];
  const eventSourceRef = useRef<EventSource | null>(null);
  const isMobile = useIsMobile();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin" || authUser?.role === "head_admin";
  const { language: selectedLanguage } = useLanguage();
  const [, setLocation] = useLocation();

  // ─── Download App State ───────────────────────────────────────────
  const { data: latestRelease } = trpc.releases.latest.useQuery();
  const requestDownloadToken = trpc.download.requestToken.useMutation();
  const [downloadPending, setDownloadPending] = useState<string | null>(null);
  const [detectedPlatform] = useState<"windows" | "mac" | "linux">(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "mac";
    if (ua.includes("linux") || ua.includes("ubuntu") || ua.includes("debian") || ua.includes("fedora")) return "linux";
    return "windows";
  });

  const handleDownloadApp = async (platform: "windows" | "mac" | "linux" | "android") => {
    if (!latestRelease) {
      toast.error("No release available yet. Check back soon!");
      return;
    }
    const platformLabel = platform === "mac" ? "macOS" : platform === "windows" ? "Windows" : platform === "android" ? "Android" : "Linux";
    const hasDownload =
      platform === "windows" ? latestRelease.hasWindows :
      platform === "mac" ? latestRelease.hasMac :
      platform === "android" ? !!(latestRelease as any).hasAndroid :
      latestRelease.hasLinux;
    if (!hasDownload) {
      toast.info(`${platformLabel} build coming soon!`);
      return;
    }
    try {
      setDownloadPending(platform);
      const { token } = await requestDownloadToken.mutateAsync({
        releaseId: latestRelease.id,
        platform: platform as "windows" | "mac" | "linux" | "android",
      });
      window.open(`/api/download/${token}`, "_blank");
      toast.success(`Downloading Titan for ${platformLabel}...`);
    } catch (err: any) {
      toast.error(err?.message ?? "Download failed. Please try again.");
    } finally {
      setDownloadPending(null);
    }
  };

  // UI state
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  // iOS keyboard height — used to shrink chat-page-root via inline style so React re-renders reliably
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // true when the user has manually scrolled up — suppress auto-scroll while set
  const isUserScrolledUpRef = useRef(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadHasSpokenRef = useRef(false); // true once volume exceeded threshold

  // Voice Mode State (full-screen voice assistant)
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const voiceModeRef = useRef(false); // non-reactive ref for use in async callbacks

  // Keep voiceModeRef in sync
  useEffect(() => { voiceModeRef.current = voiceModeActive; }, [voiceModeActive]);

  // Strip markdown for TTS (remove links, bold, code blocks, etc.)
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, '') // code blocks
      .replace(/`[^`]+`/g, '') // inline code
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images
      .replace(/#{1,6}\s/g, '') // headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/~~([^~]+)~~/g, '$1') // strikethrough
      .replace(/^[\s]*[-*+]\s/gm, '') // list markers
      .replace(/^[\s]*\d+\.\s/gm, '') // numbered lists
      .replace(/^>\s?/gm, '') // blockquotes
      .replace(/\|[^\n]+\|/g, '') // tables
      .replace(/---+/g, '') // horizontal rules
      .replace(/\n{3,}/g, '\n\n') // excessive newlines
      .trim();
  };

  // Stop any in-progress TTS playback
  const stopTtsPlayback = () => {
    try { audioSourceRef.current?.stop(); } catch (_) { /* already stopped */ }
    audioSourceRef.current = null;
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
  };

  // TTS: speak text aloud using AudioContext (Safari iOS safe)
  // Safari blocks new Audio(blobUrl).play() for programmatic audio;
  // AudioContext.decodeAudioData + BufferSource is the reliable approach.
  const speakText = async (text: string) => {
    if (!text.trim()) return;
    const cleanText = stripMarkdown(text).slice(0, 4096);
    if (!cleanText) return;

    stopTtsPlayback();
    setIsSpeaking(true);
    setVoiceStatus('speaking');

    try {
      const csrfTk = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfTk ? { 'x-csrf-token': csrfTk } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ text: cleanText, voice: 'onyx', speed: 0.95 }),
      });

      if (!res.ok) throw new Error('TTS request failed');

      const arrayBuffer = await res.arrayBuffer();

      // Create or reuse AudioContext
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      audioSourceRef.current = source;

      source.onended = () => {
        audioSourceRef.current = null;
        setIsSpeaking(false);
        if (voiceModeRef.current) {
          setVoiceStatus('idle');
          setTimeout(() => {
            if (voiceModeRef.current) {
              startRecording();
              setVoiceStatus('listening');
            }
          }, 600);
        }
      };

      source.start(0);
    } catch (err) {
      console.error('[TTS] Error:', err);
      setIsSpeaking(false);
      if (voiceModeRef.current) setVoiceStatus('idle');
    }
  };

  // Enter voice mode
  const enterVoiceMode = () => {
    setVoiceModeActive(true);
    setVoiceStatus('idle');
    // Start listening immediately
    setTimeout(() => {
      startRecording();
      setVoiceStatus('listening');
    }, 300);
  };

  // Exit voice mode — cleans up all recording/TTS state and returns to chat
  const exitVoiceMode = () => {
    // Cancel VAD so it doesn't fire after exit
    vadAnalyserRef.current = null;
    if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = null; }
    if (vadSilenceTimerRef.current) { clearTimeout(vadSilenceTimerRef.current); vadSilenceTimerRef.current = null; }
    // Stop recording timer
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Stop any TTS playback
    stopTtsPlayback();
    // Reset all voice state
    setIsSpeaking(false);
    setIsRecording(false);
    setRecordingDuration(0);
    setVoiceStatus('idle');
    // Deactivate voice mode overlay — chat page is revealed underneath
    setVoiceModeActive(false);
  };

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => { stopTtsPlayback(); };
  }, []);

  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showProjectFiles, setShowProjectFiles] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load saved tokens from database when panel opens
  useEffect(() => {
    if (!showTokenInput) return;
    setLoadingTokens(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    fetch('/api/trpc/userSecrets.listTokens', { credentials: 'include', signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        // tRPC v10 batch responses are arrays: [{result:{data:{json:[...]}}}]
        const batchData = Array.isArray(data) ? data[0] : data;
        const tokens = batchData?.result?.data?.json || [];
        setSavedTokens(Array.isArray(tokens) ? tokens.map((t: any) => ({
          id: t.id,
          name: t.label?.split(' (')[0] || t.secretType,
          preview: t.label?.match(/\((.+)\)/)?.[1] || t.secretType,
        })) : []);
      })
      .catch(() => { setSavedTokens([]); })
      .finally(() => { clearTimeout(timeoutId); setLoadingTokens(false); });
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [showTokenInput]);
  const [tokenName, setTokenName] = useState('');
  const [tokenValue, setTokenValue] = useState('');
  const [savedTokens, setSavedTokens] = useState<Array<{id: number; name: string; preview: string}>>([]); 
  const [loadingTokens, setLoadingTokens] = useState(false);
  // ── Custom Instructions ──
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [customInstructionsText, setCustomInstructionsText] = useState('');
  const [customInstructionsSaved, setCustomInstructionsSaved] = useState(false);
  const [createdFiles, setCreatedFiles] = useState<Array<{name: string; url: string; size: number; language: string; content?: string}>>([]);
  const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(null);
  const [filePreviewContent, setFilePreviewContent] = useState<Record<number, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<number | null>(null);
  // Save As modal state — shown before any ZIP download so user can name the file
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsFilename, setSaveAsFilename] = useState('');
  const [saveAsPendingAction, setSaveAsPendingAction] = useState<'all' | 'single' | null>(null);
  const [saveAsSingleFileUrl, setSaveAsSingleFileUrl] = useState<string | null>(null);
  const [saveAsSingleFileName, setSaveAsSingleFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      e.target.value = '';
    }
  };

  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // Intercept internal navigation links in chat messages
  const handleChatClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      setLocation(href);
    }
  };

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingDuration(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          toast.error('Recording too short. Please try again.');
          setIsRecording(false);
          return;
        }

        setIsRecording(false);
        setIsTranscribing(true);
        if (voiceModeRef.current) setVoiceStatus('thinking');
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording.${mimeType.includes('webm') ? 'webm' : 'm4a'}`);
          const csrfTk = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
          const uploadRes = await fetch('/api/voice/upload', { method: 'POST', body: formData, credentials: 'include', headers: csrfTk ? { 'x-csrf-token': csrfTk } : {} });
          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(err.error || 'Failed to upload audio');
          }
          const { url: audioUrl } = await uploadRes.json();
          // Pass the selected UI language as a hint to Whisper STT.
          // Whisper will auto-detect the actual spoken language regardless,
          // but this hint improves accuracy when the language is known.
          const result = await transcribeMutation.mutateAsync({ audioUrl, language: selectedLanguage });
          if (result.text && result.text.trim()) {
            if (voiceModeRef.current) setVoiceStatus('thinking');
            handleSend(result.text.trim());
          } else {
            toast.error('Could not understand the audio. Please try again.');
            if (voiceModeRef.current) setVoiceStatus('idle');
          }
        } catch (err: any) {
          console.error('[Voice] Transcription error:', err);
          toast.error(err.message || 'Voice transcription failed. Please try again.');
          if (voiceModeRef.current) setVoiceStatus('idle');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      if (!voiceModeRef.current) toast.success('Recording started. Tap stop when done.');
      if (voiceModeRef.current) setVoiceStatus('listening');

      // ── Voice Activity Detection (VAD) ─────────────────────────────
      // Only active in voice mode. Monitors microphone volume via AnalyserNode.
      // Auto-stops after 1.5s of silence once the user has spoken (volume > threshold).
      if (voiceModeRef.current) {
        vadHasSpokenRef.current = false;
        vadStreamRef.current = stream;
        try {
          const vadCtx = audioCtxRef.current && audioCtxRef.current.state !== 'closed'
            ? audioCtxRef.current
            : new (window.AudioContext || (window as any).webkitAudioContext)();
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = vadCtx;
          }
          if (vadCtx.state === 'suspended') await vadCtx.resume();
          const source = vadCtx.createMediaStreamSource(stream);
          const analyser = vadCtx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.3;
          source.connect(analyser);
          vadAnalyserRef.current = analyser;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const SILENCE_THRESHOLD = 12;   // RMS below this = silence
          const SILENCE_DURATION = 1500;  // ms of silence before auto-stop
          const MIN_SPEECH_MS = 400;      // must have spoken for at least this long
          let speechStartTime = 0;
          const checkVad = () => {
            if (!vadAnalyserRef.current) return;
            analyser.getByteTimeDomainData(dataArray);
            // Compute RMS volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length) * 100;
            if (rms > SILENCE_THRESHOLD) {
              // User is speaking
              if (!vadHasSpokenRef.current) {
                vadHasSpokenRef.current = true;
                speechStartTime = Date.now();
              }
              // Cancel any pending silence timer
              if (vadSilenceTimerRef.current) {
                clearTimeout(vadSilenceTimerRef.current);
                vadSilenceTimerRef.current = null;
              }
            } else if (vadHasSpokenRef.current && !vadSilenceTimerRef.current) {
              // Silence detected after speech — start countdown
              const spokenMs = Date.now() - speechStartTime;
              if (spokenMs >= MIN_SPEECH_MS) {
                vadSilenceTimerRef.current = setTimeout(() => {
                  vadSilenceTimerRef.current = null;
                  // Auto-stop recording
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                  }
                  // Clean up VAD
                  vadAnalyserRef.current = null;
                  if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
                  vadRafRef.current = null;
                }, SILENCE_DURATION);
              }
            }
            vadRafRef.current = requestAnimationFrame(checkVad);
          };
          vadRafRef.current = requestAnimationFrame(checkVad);
        } catch (vadErr) {
          console.warn('[VAD] Could not start voice activity detection:', vadErr);
        }
      }
    } catch (err: any) {
      console.error('[Voice] Microphone access error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        toast.error('Could not access microphone. Please check your device settings.');
      }
    }
  };

  const stopRecording = () => {
    // Cancel VAD before stopping so it doesn't fire again
    vadAnalyserRef.current = null;
    if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = null; }
    if (vadSilenceTimerRef.current) { clearTimeout(vadSilenceTimerRef.current); vadSilenceTimerRef.current = null; }
    // Immediately update voiceStatus so the Stop button disappears and UI shows 'thinking'
    // The onstop handler will also set it to 'thinking', but this gives instant feedback
    if (voiceModeRef.current) setVoiceStatus('thinking');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Load conversation messages
  const { data: convDetail, refetch: refetchConv } =
    trpc.chat.getConversation.useQuery(
      { conversationId: activeConversationId! },
      { enabled: !!activeConversationId, refetchOnWindowFocus: false }
    );

  const { data: quickActions } = trpc.chat.quickActions.useQuery(undefined, { refetchOnWindowFocus: false });
  const sendMutation = trpc.chat.send.useMutation();
  const utils = trpc.useUtils();

  // ── Custom Instructions ──
  const { data: customInstructionsData } = trpc.customInstructions.get.useQuery(undefined, { refetchOnWindowFocus: false });
  const saveCustomInstructionsMutation = trpc.customInstructions.save.useMutation();
  useEffect(() => {
    if (customInstructionsData?.customInstructions != null) {
      setCustomInstructionsText(customInstructionsData.customInstructions);
    }
  }, [customInstructionsData]);

  // Track optimistic (unsaved) message IDs so the DB sync never wipes them
  const optimisticIdsRef = useRef<Set<number>>(new Set());
  // Track the conversation ID that was last synced to detect conversation switches
  const lastSyncedConvIdRef = useRef<number | null>(null);

  // Sync DB messages into local state.
  // ALWAYS merges: DB messages are the source of truth, but optimistic
  // messages (negative IDs tracked in optimisticIdsRef) are preserved until
  // the DB catches up. This prevents the "flicker and disappear" bug.
  useEffect(() => {
    if (!convDetail?.messages) return;
    // Update the last synced conversation ID (for tracking purposes only)
    lastSyncedConvIdRef.current = activeConversationId;
    // Always use merge strategy — even on conversation switch, because
    // when we pre-create a conversation and then the query fires with
    // empty messages, we must NOT wipe optimistic messages.
    setLocalMessages((prev) => {
      const dbMessages: ChatMsg[] = convDetail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        actionsTaken: m.actionsTaken,
        toolCalls: m.toolCalls,
      }));
      // Collect optimistic messages still pending (negative IDs not yet in DB)
      const pendingOptimistic = prev.filter(
        (m) => optimisticIdsRef.current.has(m.id)
      );
      // Check if DB now contains messages that match our optimistic ones
      // (match by role + content since DB IDs differ from temp IDs)
      const stillPending = pendingOptimistic.filter((opt) => {
        const found = dbMessages.some(
          (db) => db.role === opt.role && db.content === opt.content
        );
        if (found) {
          // DB caught up — remove from optimistic tracking
          optimisticIdsRef.current.delete(opt.id);
        }
        return !found;
      });
      // Final list: DB messages + any still-pending optimistic messages appended.
      // Always sort so messages appear in correct conversation order:
      //   - Positive IDs (DB messages) sort ascending by ID (insertion order)
      //   - Negative IDs (optimistic) always come after all DB messages,
      //     sorted by absolute value descending so the most-recently-sent is last.
      const merged = stillPending.length === 0 ? dbMessages : [...dbMessages, ...stillPending];
      return merged.sort((a, b) => {
        if (a.id > 0 && b.id > 0) return a.id - b.id;      // both DB: ascending
        if (a.id > 0) return -1;                             // DB before optimistic
        if (b.id > 0) return 1;                              // DB before optimistic
        return Math.abs(b.id) - Math.abs(a.id);              // both optimistic: newest last
      });
    });
  }, [convDetail, activeConversationId]);

  // Clear local messages and file panel when switching to new conversation
  useEffect(() => {
    if (!activeConversationId) {
      setLocalMessages([]);
      setCreatedFiles([]);
      setExpandedFileIdx(null);
      setFilePreviewContent({});
      optimisticIdsRef.current.clear();
    }
  }, [activeConversationId]);

  // Restore createdFiles from DB toolCalls when loading a past conversation.
  // This ensures the Project Files panel repopulates when switching back to a
  // conversation where files were previously created.
  useEffect(() => {
    if (!localMessages.length) return;
    const restored: Array<{name: string; url: string; size: number; language: string; content?: string}> = [];
    for (const msg of localMessages) {
      if (!msg.toolCalls) continue;
      for (const tc of msg.toolCalls) {
        if ((tc.name === 'create_file' || tc.name === 'sandbox_write_file') && tc.result) {
          const d = tc.result as any;
          const name = d.fileName || (tc.args as any)?.fileName || (tc.args as any)?.filePath || 'unknown';
          const url = d.url || '';
          const size = d.size || 0;
          const language = d.language || 'text';
          // Deduplicate by name — keep last version
          const existingIdx = restored.findIndex(f => f.name === name);
          if (existingIdx >= 0) {
            restored[existingIdx] = { name, url, size, language };
          } else {
            restored.push({ name, url, size, language });
          }
        }
      }
    }
    if (restored.length > 0) {
      setCreatedFiles(restored);
    }
  }, [localMessages]);

  // ── Auto-reconnect to active builds on page load / conversation switch ──
  // If the user logged out, closed the tab, or refreshed while Titan was working,
  // this detects the still-running build and reconnects the SSE stream.
  useEffect(() => {
    if (!activeConversationId || isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/build-status/${activeConversationId}`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const status = await res.json();
        if (status.active) {
          // Build is still running — reconnect SSE and show loading state
          setIsLoading(true);
          setLoadingPhase(status.currentPhase || 'Resuming build...');
          toast.info('Titan is still working — reconnecting...');
          // Reconnect SSE stream
          const es = new EventSource(`/api/chat/stream/${activeConversationId}`, { withCredentials: true });
          eventSourceRef.current = es;
          es.addEventListener('thinking', (e) => { try { const d = JSON.parse(e.data); setStreamEvents(prev => [...prev.slice(-20), { type: 'thinking', message: d.message, reasoning: d.reasoning, phase: d.phase, round: d.round, timestamp: Date.now() }]); if (!d.reasoning) setLoadingPhase(d.message || 'Thinking...'); } catch {} });
          es.addEventListener('tool_start', (e) => { try { const d = JSON.parse(e.data); setStreamEvents(prev => [...prev.slice(-20), { type: 'tool_start', tool: d.tool, description: d.description, timestamp: Date.now() }]); setLoadingPhase(d.description || `Running ${d.tool}...`); } catch {} });
          es.addEventListener('tool_result', (e) => { try { const d = JSON.parse(e.data); setStreamEvents(prev => [...prev.slice(-20), { type: 'tool_result', tool: d.tool, success: d.success, summary: d.summary, timestamp: Date.now() }]); } catch {} });
          es.addEventListener('status', (e) => { try { const d = JSON.parse(e.data); setStreamEvents(prev => [...prev.slice(-20), { type: 'status', message: d.message, timestamp: Date.now() }]); setLoadingPhase(d.message || 'Processing...'); } catch {} });
          es.addEventListener('done', () => {
            es.close(); eventSourceRef.current = null;
            setIsLoading(false); setStreamEvents([]);
            utils.chat.getConversation.invalidate({ conversationId: activeConversationId });
          });
          es.addEventListener('aborted', () => { es.close(); eventSourceRef.current = null; setIsLoading(false); setStreamEvents([]); });
          es.addEventListener('error', () => { es.close(); eventSourceRef.current = null; setIsLoading(false); setStreamEvents([]); });
        } else if (status.status === 'completed' && status.response) {
          // Build finished while we were away — refresh messages
          utils.chat.getConversation.invalidate({ conversationId: activeConversationId });
        }
      } catch {
        // Silently fail — not critical
      }
    })();
    return () => { cancelled = true; };
  }, [activeConversationId]);

  // ── Sticky-bottom scroll ─────────────────────────────────────────────
  // Rules:
  //   1. While the user is pinned to the bottom, scroll down on every content
  //      height change (new messages, streaming tokens, images loading).
  //   2. When the user manually scrolls UP, stop auto-scrolling.
  //   3. When the user scrolls back to the bottom, re-enable auto-scrolling.
  //   4. Sending a new message always re-pins to the bottom.
  // This replaces the old naive `scrollTop = scrollHeight` on every render
  // which caused the chat to jump while typing (textarea resize) and failed
  // to follow streaming tokens.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Helper: scroll to bottom instantly (no animation — avoids jitter)
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };

    // Detect manual scroll: if user scrolls up more than 80px from bottom,
    // mark as scrolled-up. If they return within 40px of the bottom, re-pin.
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom > 80) {
        isUserScrolledUpRef.current = true;
      } else if (distFromBottom <= 40) {
        isUserScrolledUpRef.current = false;
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });

    // Watch the inner content div for height changes (new messages, tokens)
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return () => el.removeEventListener('scroll', handleScroll);

    const ro = new ResizeObserver(() => {
      if (!isUserScrolledUpRef.current) {
        scrollToBottom();
      }
    });
    ro.observe(inner);

    // Initial scroll to bottom when the component mounts or conversation changes
    scrollToBottom();

    return () => {
      el.removeEventListener('scroll', handleScroll);
      ro.disconnect();
    };
  // Re-run when the conversation changes so we scroll to the bottom of the new chat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Cycle loading phase text
  useEffect(() => {
    if (!isLoading) return;
    const phases = ["Thinking...", "Analyzing request...", "Executing actions...", "Processing results..."];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setLoadingPhase(phases[idx]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Process queued messages after current build finishes
  useEffect(() => {
    if (!isLoading && messageQueue.length > 0 && !isProcessingRef.current) {
      isProcessingRef.current = true;
      const nextMessage = messageQueue[0];
      setMessageQueue((prev) => prev.slice(1));
      // Small delay to let the UI update before sending next message
      const timer = setTimeout(() => {
        isProcessingRef.current = false;
        handleSend(nextMessage);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, messageQueue]);

  // iOS keyboard handling — use React state so the component re-renders with the correct height.
  // CSS variable approach is unreliable on iOS Safari when body is not position:fixed.
  useEffect(() => {
    if (!isMobile) return;
    const updateLayout = () => {
      if (!window.visualViewport) return;
      const vv = window.visualViewport;
      // keyboard height = difference between window height and visual viewport height
      const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(kbHeight);
      // Also keep the CSS variable in sync for any CSS that still uses it
      document.documentElement.style.setProperty('--keyboard-offset', `${kbHeight}px`);
      // Scroll messages to bottom when keyboard opens (if user is pinned)
      requestAnimationFrame(() => {
        if (scrollRef.current && !isUserScrolledUpRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    };
    const handleScroll = () => {
      // Prevent iOS from scrolling the page body when keyboard shifts the viewport
      if (window.visualViewport && window.visualViewport.offsetTop > 0) {
        window.scrollTo(0, 0);
      }
      updateLayout();
    };
    window.visualViewport?.addEventListener('resize', updateLayout);
    window.visualViewport?.addEventListener('scroll', handleScroll);
    // Run once on mount to capture initial state
    updateLayout();
    return () => {
      window.visualViewport?.removeEventListener('resize', updateLayout);
      window.visualViewport?.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    // Mid-run injection: if Titan is processing, inject the message directly
    // into his active context so he reads it on his next loop iteration.
    // The message also appears in chat immediately with an amber indicator.
    if (isLoading) {
      const midRunMsg: ChatMsg = { id: -Date.now(), role: 'user', content: messageText, createdAt: Date.now() };
      optimisticIdsRef.current.add(midRunMsg.id);
      // Re-pin to bottom so the user sees the injected message
      isUserScrolledUpRef.current = false;
      setLocalMessages((prev) => [...prev, { ...midRunMsg, content: `⚡ [Mid-run note] ${messageText}` }]);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      // Fire-and-forget: inject into Titan's active context
      if (activeConversationId) {
        const csrfTkn = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
        fetch(`/api/chat/inject/${activeConversationId}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(csrfTkn ? { 'x-csrf-token': csrfTkn } : {}) },
          body: JSON.stringify({ message: messageText }),
        }).then(async r => {
          if (r.ok) {
            toast.success('Titan will read this mid-task', { duration: 2000 });
          } else {
            // 409 means no active build registered yet (e.g. still in first round)
            // The message is already shown in chat — Titan will see it when he finishes
            const data = await r.json().catch(() => ({}));
            if (r.status === 409) {
              toast.info('Message noted — Titan will see it when he finishes', { duration: 2500 });
            } else {
              toast.error(data?.error || 'Could not send mid-task message');
            }
          }
        }).catch(() => toast.error('Could not send mid-task message'));
      }
      return;
    }

    // Handle slash commands
    const lowerText = messageText.toLowerCase().trim();
    const slashCmd = SLASH_COMMANDS.find(c => c.command === lowerText);
    setShowSlashMenu(false);

    if (lowerText === '/help' || lowerText === 'help') {
      setInput('');
      setShowHelp(true);
      const helpUserMsg: ChatMsg = { id: -Date.now(), role: 'user', content: messageText, createdAt: Date.now() };
      optimisticIdsRef.current.add(helpUserMsg.id);
      setLocalMessages((prev) => [...prev, helpUserMsg]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (lowerText === '/new') {
      setInput('');
      handleNewConversation();
      toast.success('New conversation started');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (lowerText === '/clear') {
      setInput('');
      setLocalMessages([]);
      optimisticIdsRef.current.clear();
      setShowHelp(false);
      toast.success('Chat cleared');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (slashCmd?.action === 'navigate' && slashCmd.path) {
      setInput('');
      setLocation(slashCmd.path);
      toast.success(`Navigating to ${slashCmd.label}`);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (slashCmd?.action === 'send' && slashCmd.prompt) {
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      handleSend(slashCmd.prompt);
      return;
    }

    setShowHelp(false);

    // Capture files before clearing state
    const filesToUpload = [...selectedFiles];
    setInput("");
    setSelectedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Upload files FIRST so we can show them in the optimistic message
    const uploadedAttachments: ChatAttachment[] = [];
    if (filesToUpload.length > 0) {
      setIsLoading(true);
      setLoadingPhase("Uploading files...");
      for (const file of filesToUpload) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          // Read CSRF token from cookie and send as header
          const csrfToken = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
          const uploadRes = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
          });
          if (uploadRes.ok) {
            const { url, mimeType, size } = await uploadRes.json();
            uploadedAttachments.push({ url, name: file.name, mimeType: mimeType || file.type, size: size || file.size });
          } else {
            const errData = await uploadRes.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Upload failed:', uploadRes.status, errData);
            toast.error(`Upload failed (${uploadRes.status}): ${errData.error || 'Server error'}`);
          }
        } catch (e) {
          console.error('File upload failed:', e);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    }

    // Build the optimistic user message WITH attachment info
    const tempId = -Date.now();
    const userMsg: ChatMsg = {
      id: tempId,
      role: "user",
      content: messageText,
      createdAt: Date.now(),
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
    };
    // Register as optimistic so the DB sync effect won't wipe it
    optimisticIdsRef.current.add(tempId);
    // Re-pin to bottom whenever the user sends a new message
    isUserScrolledUpRef.current = false;
    setLocalMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setLoadingPhase("Thinking...");
    setIsBuildMode(false);
    setStreamEvents([{ type: 'thinking', message: 'Processing your request...', timestamp: Date.now() }]);
    setBuildLog([]);

    // Pre-create conversation if this is a new chat, so we can connect SSE before sending
    let convIdForStream = activeConversationId;
    if (!convIdForStream) {
      try {
        const newConv = await utils.client.chat.createConversation.mutate({});
        convIdForStream = newConv.id;
        setActiveConversationId(newConv.id);
        utils.chat.listConversations.invalidate();
      } catch {
        // Failed to pre-create — sendMessage will create it server-side
      }
    }

    // Connect to SSE stream for real-time events
    if (convIdForStream) {
      try {
        const es = new EventSource(`/api/chat/stream/${convIdForStream}`);
        eventSourceRef.current = es;
        es.addEventListener('tool_start', (e) => {
          const data = JSON.parse(e.data);
          const evt: StreamEvent = { type: 'tool_start', tool: data.tool, description: data.description, round: data.round, timestamp: Date.now() };
          setStreamEvents(prev => [...prev, evt]);
          setBuildLog(prev => [...prev, evt]);
          setLoadingPhase(data.description || `Using ${data.tool.replace(/_/g, ' ')}...`);
          // Detect builder/security mode
          if (SECURITY_TOOLS.includes(data.tool)) setIsBuildMode(true);
        });
        es.addEventListener('tool_result', (e) => {
          const data = JSON.parse(e.data);
          const evt: StreamEvent = { type: 'tool_result', tool: data.tool, success: data.success, summary: data.summary, preview: data.preview, round: data.round, timestamp: Date.now() };
          setStreamEvents(prev => [...prev, evt]);
          setBuildLog(prev => [...prev, evt]);
        });
        es.addEventListener('thinking', (e) => {
          const data = JSON.parse(e.data);
          const evt: StreamEvent = { type: 'thinking', message: data.message, round: data.round, reasoning: data.reasoning, phase: data.phase, timestamp: Date.now() };
          setStreamEvents(prev => [...prev, evt]);
          setBuildLog(prev => [...prev, evt]);
          // Only update the loading phase label with non-reasoning events (reasoning content is shown in the panel)
          if (!data.reasoning) setLoadingPhase(data.message || 'Thinking...');
        });
        es.addEventListener('status', (e) => {
          const data = JSON.parse(e.data);
          const evt: StreamEvent = { type: 'status', message: data.message, timestamp: Date.now() };
          setStreamEvents(prev => [...prev, evt]);
          setBuildLog(prev => [...prev, evt]);
          setLoadingPhase(data.message || 'Working...');
        });
        es.addEventListener('verification', (e) => {
          const data = JSON.parse(e.data);
          const evt: StreamEvent = { type: 'verification', message: data.message, results: data.results, block: data.block, error: data.error, timestamp: Date.now() };
          setStreamEvents(prev => [...prev, evt]);
          setBuildLog(prev => [...prev, evt]);
          setLoadingPhase(data.message || 'Verification complete');
        });
        es.addEventListener('done', () => { es.close(); eventSourceRef.current = null; });
        es.addEventListener('error', () => { es.close(); eventSourceRef.current = null; });
        es.addEventListener('aborted', () => { es.close(); eventSourceRef.current = null; });
      } catch {
        // SSE connection failed — continue without streaming
      }
    }

    try {
      // Build final message with attachment URLs for the AI
      let finalMessage = messageText;
      if (uploadedAttachments.length > 0) {
        const attachmentLines = uploadedAttachments.map(a => {
          if (a.mimeType.startsWith('image/')) {
            return `[Attached image: ${a.name}](${a.url})`;
          }
          return `[Attached file: ${a.name}](${a.url})`;
        });
        finalMessage += '\n\n' + attachmentLines.join('\n');
        const hasImages = uploadedAttachments.some(a => a.mimeType.startsWith('image/'));
        if (hasImages) {
          finalMessage += '\n\nI have attached image(s) above. Please analyze them using the read_uploaded_file tool.';
        } else {
          finalMessage += '\n\nPlease read the attached file(s) using the read_uploaded_file tool to see their contents.';
        }
      }
      const result = await sendMutation.mutateAsync({
        message: finalMessage,
        conversationId: convIdForStream || undefined,
        preferredLanguage: selectedLanguage,
      });

      // If conversation was created server-side (fallback), update the ID
      if (!convIdForStream && result.conversationId) {
        setActiveConversationId(result.conversationId);
        utils.chat.listConversations.invalidate();
      }

      const assistantMsg: ChatMsg = {
        id: -Date.now() - 1,
        role: "assistant",
        content: result.response,
        createdAt: Date.now(),
        actionsTaken: result.actions
          ? result.actions.map((a: ExecutedAction) => {
              let summary = a.success ? `Executed ${a.tool}` : `Failed ${a.tool}`;
              const d = a.result as any;
              if (d) {
                switch (a.tool) {
                  case "self_type_check":
                    summary = d.passed ? "TypeScript: 0 errors" : `TypeScript: ${d.errorCount} error(s)`;
                    break;
                  case "self_run_tests":
                    summary = d.passed ? `Tests: ${d.totalTests} passed` : `Tests: ${d.failedTests}/${d.totalTests} failed`;
                    break;
                  case "self_modify_file":
                    summary = a.success ? `Modified ${a.args?.filePath || "file"}` : `Failed to modify ${a.args?.filePath || "file"}`;
                    break;
                  case "self_multi_file_modify":
                    summary = d.summary || (a.success ? `${(d.modifications || []).length} file(s) modified` : "Multi-file modify failed");
                    break;
                  case "self_health_check":
                    summary = d.healthy ? "All systems healthy" : `${(d.checks || []).filter((c: any) => !c.passed).length} issue(s) detected`;
                    break;
                  case "self_rollback":
                    summary = a.success ? `Rolled back (${d.filesRestored || 0} files restored)` : "Rollback failed";
                    break;
                  case "self_restart":
                    summary = a.success ? "Server restart triggered" : "Restart failed";
                    break;
                  case "self_read_file":
                    summary = `Read ${a.args?.filePath || "file"} (${d.length || 0} chars)`;
                    break;
                  case "self_list_files":
                    summary = `Listed ${d.count || 0} files in ${a.args?.dirPath || "directory"}`;
                    break;
                  case "create_file":
                    summary = a.success ? `Created ${d.fileName || a.args?.fileName || "file"} (${d.size ? (d.size < 1024 ? d.size + 'B' : (d.size / 1024).toFixed(1) + 'KB') : ''})` : `Failed to create ${a.args?.fileName || "file"}`;
                    break;
                  case "create_github_repo":
                    summary = a.success ? `Created repo: ${d.repoFullName || a.args?.name}` : `Failed to create repo`;
                    break;
                  case "push_to_github":
                    summary = a.success ? `Pushed ${d.filesPushed || 0} files to ${d.repoFullName || a.args?.repoFullName}` : `Failed to push to GitHub`;
                    break;
                  case "read_uploaded_file":
                    summary = a.success ? `Read uploaded file (${d.size || 0} chars)` : `Failed to read file`;
                    break;
                }
              }
              return { tool: a.tool, success: a.success, summary };
            })
          : null,
      };

      // Register assistant message as optimistic so DB sync won't wipe it
      optimisticIdsRef.current.add(assistantMsg.id);
      setLocalMessages((prev) => [...prev, assistantMsg]);

      // Voice Mode: speak the response aloud
      if (voiceModeRef.current && result.response) {
        speakText(result.response);
      }

      // Track created files for the project files panel
      if (result.actions && result.actions.length > 0) {
        const newFiles = result.actions
          .filter((a: ExecutedAction) => a.tool === 'create_file' && a.success && a.result)
          .map((a: ExecutedAction) => {
            const d = a.result as any;
            return {
              name: d.fileName || (a.args as any)?.fileName || 'unknown',
              url: d.url || '',
              size: d.size || 0,
              language: d.language || 'text',
            };
          });
        if (newFiles.length > 0) {
          setCreatedFiles(prev => {
            // Deduplicate: replace existing files with the same name (rewrites)
            const updated = [...prev];
            for (const nf of newFiles) {
              const existingIdx = updated.findIndex(f => f.name === nf.name);
              if (existingIdx >= 0) {
                updated[existingIdx] = nf; // Replace old version
              } else {
                updated.push(nf); // New file
              }
            }
            return updated;
          });
          setShowProjectFiles(true);
        }
      }
      if (result.actions && result.actions.length > 0) {
        const successCount = result.actions.filter((a: ExecutedAction) => a.success).length;
        const failCount = result.actions.length - successCount;
        if (failCount === 0) {
          toast.success(`${successCount} action${successCount > 1 ? "s" : ""} completed`);
        } else {
          toast.warning(`${successCount} succeeded, ${failCount} failed`);
        }
      }

      utils.chat.listConversations.invalidate();
      // The server generates the conversation title asynchronously via LLM.
      // Schedule a follow-up invalidation after ~3 seconds to pick up the generated title.
      setTimeout(() => {
        utils.chat.listConversations.invalidate();
      }, 3000);
    } catch (err: any) {
      const serverMessage = err?.message || err?.data?.message || "";

      // ── Network-level failure recovery (Safari iOS 'Load failed') ──────────
      // When Safari drops the HTTP connection (Railway 5-min timeout, ITP, etc.)
      // the fetch throws TypeError: 'Load failed'. The server may have already
      // finished processing — poll the build-status endpoint to recover the result.
      const isNetworkFailure = serverMessage === 'Load failed' ||
        serverMessage.toLowerCase().includes('load failed') ||
        serverMessage.toLowerCase().includes('network request failed') ||
        serverMessage.toLowerCase().includes('failed to fetch') ||
        serverMessage.toLowerCase().includes('aborted') ||
        serverMessage.toLowerCase().includes('network error') ||
        serverMessage.toLowerCase().includes('networkerror') ||
        serverMessage.toLowerCase().includes('the operation couldn');

      if (isNetworkFailure && convIdForStream) {
        // Poll build-status up to 60 times (5 min total) waiting for completion
        let recovered = false;
        toast.info('Connection interrupted — checking if Titan is still working...', { duration: 10000 });
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const statusRes = await fetch(`/api/chat/build-status/${convIdForStream}`, { credentials: 'include' });
            if (statusRes.ok) {
              const status = await statusRes.json();
              if (status.status === 'completed' && status.response) {
                // Build completed — show the response
                const recoveredMsg: ChatMsg = {
                  id: -Date.now() - 1,
                  role: 'assistant',
                  content: status.response,
                  createdAt: Date.now(),
                  actionsTaken: status.actions
                    ? status.actions.map((a: any) => ({ tool: a.tool, success: a.success, summary: a.summary || `${a.success ? 'Executed' : 'Failed'} ${a.tool}` }))
                    : null,
                };
                optimisticIdsRef.current.add(recoveredMsg.id);
                setLocalMessages(prev => [...prev, recoveredMsg]);
                if (voiceModeRef.current && status.response) speakText(status.response);
                utils.chat.listConversations.invalidate();
                recovered = true;
                break;
              } else if (status.status === 'failed') {
                break; // Server-side failure — fall through to error display
              }
              // Still running — keep polling
              if (attempt % 6 === 5) {
                toast.info('Titan is still working — waiting for completion...', { duration: 5000 });
              }
            }
          } catch {
            // Poll failed — keep trying
          }
        }
        if (recovered) {
          toast.success('Titan finished! Response recovered successfully.');
          return; // Skip error display — response was recovered
        }
      }
      // ── Standard error display ──────────────────────────────────────────────
      let userFacingError = "Something went wrong. Please try again.";
      if (serverMessage.toLowerCase().includes("credit")) {
        userFacingError = serverMessage;
      } else if (serverMessage.toLowerCase().includes("unauthorized") || serverMessage.toLowerCase().includes("session")) {
        userFacingError = "Session expired. Please refresh the page and try again.";
      } else if (serverMessage.toLowerCase().includes("rate limit") || serverMessage.toLowerCase().includes("too many")) {
        userFacingError = "Rate limit reached. Please wait a moment and try again.";
      } else if (serverMessage.toLowerCase().includes("timeout") || serverMessage.toLowerCase().includes("timed out")) {
        userFacingError = "The request timed out. This can happen with complex builds. Try again or break the request into smaller parts.";
      } else if (isNetworkFailure) {
        userFacingError = "Connection dropped — Titan may still be working in the background. Refresh the page to check for a response.";
      } else if (serverMessage) {
        userFacingError = serverMessage;
      }
      toast.error(userFacingError);
      // KEEP the user message visible — don't delete it on error.
      // Instead, add an error assistant message so the user can see what happened.
      const errorAssistantMsg: ChatMsg = {
        id: -Date.now() - 2,
        role: "assistant",
        content: `⚠️ ${userFacingError}`,
        createdAt: Date.now(),
      };
      optimisticIdsRef.current.add(errorAssistantMsg.id);
      setLocalMessages((prev) => [...prev, errorAssistantMsg]);
      // Preserve the build log so the user can see what was done before the error
      if (streamEvents.length > 0) {
        setBuildLog([...streamEvents]);
      }
    } finally {
      setStreamEvents([]);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // Refetch conversation so the DB sync effect can reconcile optimistic messages.
      // Even if this fails, optimistic messages remain visible until the next successful sync.
      if (activeConversationId || convIdForStream) {
        try {
          await refetchConv();
        } catch {
          // Refetch failed — optimistic messages will remain until next sync
        }
      }
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setLocalMessages([]);
    optimisticIdsRef.current.clear();
    setShowHelp(false);
  };

  const handleSelectConversation = (id: number) => {
    // When user manually selects a different conversation, clear optimistic state
    if (id !== activeConversationId) {
      optimisticIdsRef.current.clear();
      setLocalMessages([]);
    }
    setActiveConversationId(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIdx(prev => Math.min(prev + 1, filteredSlashCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIdx(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        const cmd = filteredSlashCommands[slashSelectedIdx];
        if (cmd) {
          setInput(cmd.command);
          setShowSlashMenu(false);
          if (e.key === 'Enter') handleSend(cmd.command);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";

    if (val.startsWith('/')) {
      setSlashFilter(val.toLowerCase());
      setShowSlashMenu(true);
      setSlashSelectedIdx(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const filteredSlashCommands = SLASH_COMMANDS.filter(c =>
    slashFilter ? c.command.startsWith(slashFilter) || c.label.toLowerCase().includes(slashFilter.slice(1)) : true
  );

  const showEmptyState = localMessages.length === 0 && !isLoading;

  // Handle regenerate last message
  const handleRegenerate = () => {
    const lastUserMsg = [...localMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove the last assistant message
      setLocalMessages(prev => {
        const idx = prev.length - 1;
        if (prev[idx]?.role === 'assistant') return prev.slice(0, idx);
        return prev;
      });
      handleSend(lastUserMsg.content);
    }
  };

  const lastMessage = localMessages[localMessages.length - 1];
  const canRegenerate = lastMessage?.role === 'assistant' && !isLoading;


  return (
    <div
      className={`chat-page-root flex ${isMobile ? 'h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]' : 'h-[calc(100vh-3rem)]'}`}
      style={isMobile && keyboardHeight > 0 ? {
        // Shrink the chat area by the keyboard height so the input stays visible.
        // Using inline style (not CSS var) forces a React re-render which is
        // reliable on iOS Safari — CSS variable updates alone are not.
        height: `calc(100dvh - 3.5rem - ${keyboardHeight}px)`,
        maxHeight: `calc(100dvh - 3.5rem - ${keyboardHeight}px)`,
      } : undefined}
    >
      {/* Mobile Conversation Drawer */}
      {isMobile && (
        <MobileConversationDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          activeId={activeConversationId}
          onDelete={(deletedId) => {
            if (deletedId === activeConversationId) {
              handleNewConversation();
            }
          }}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      )}

      {/* Desktop Conversation Sidebar */}
      {!isMobile && (
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={(deletedId) => {
            if (deletedId === activeConversationId) {
              handleNewConversation();
            }
          }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main chat area */}
      <div className={`flex-1 flex flex-col min-w-0 ${showProjectFiles && !isMobile ? 'mr-[420px]' : ''}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0 ${isMobile ? 'px-2 py-2 min-h-[48px]' : 'px-4 pb-3 pt-1'}`}>
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            {/* Mobile: Conversation list button */}
            {isMobile && (
              <button
                onClick={() => setMobileDrawerOpen(true)}
                className="p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 touch-target"
                aria-label="Open conversations"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div
              className="flex items-center gap-1.5 sm:gap-3 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLocation("/")}
              role="button"
              tabIndex={0}
              title="Go to home"
            >
              <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                <TitanLogo size="sm" className="!h-10 !w-10 sm:!h-14 sm:!w-14" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-semibold tracking-tight truncate">
                  Welcome to Titan
                </h1>
                {!isMobile && (
                  <p className="text-[11px] text-muted-foreground">
                    Executes real actions on your behalf
                  </p>
                )}
              </div>
            </div>
            {!isMobile && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-1 shrink-0">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                Actions Enabled
              </Badge>
            )}
            {!isMobile && isBuildMode && (
              <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 ml-1 shrink-0 animate-pulse">
                <Crosshair className="h-2.5 w-2.5 mr-0.5" />
                Builder Mode
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isAdmin && buildLog.filter(e => e.type === 'tool_start').length > 0 && (
              <button
                onClick={() => setShowBuilderHistory(!showBuilderHistory)}
                className={`flex items-center gap-1 rounded-lg font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all touch-target ${isMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
                title="View builder action log"
              >
                <ScanSearch className="h-3.5 w-3.5 shrink-0" />
                {!isMobile && `Actions (${buildLog.filter(e => e.type === 'tool_start').length})`}
                {isMobile && buildLog.filter(e => e.type === 'tool_start').length}
              </button>
            )}
            {!isAdmin && createdFiles.length > 0 && (
              <button
                onClick={() => setShowProjectFiles(!showProjectFiles)}
                className={`flex items-center gap-1 rounded-lg font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all touch-target ${isMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                {!isMobile && `Files (${createdFiles.length})`}
                {isMobile && createdFiles.length}
              </button>
            )}
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className={`flex items-center gap-1 rounded-lg font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all touch-target ${isMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
              title="Add API tokens for the builder to use"
            >
              <Key className="h-3.5 w-3.5 shrink-0" />
              {!isMobile && `Tokens${savedTokens.length > 0 ? ` (${savedTokens.length})` : ''}`}
              {isMobile && savedTokens.length > 0 && savedTokens.length}
            </button>
            <button
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
              className={`flex items-center gap-1 rounded-lg font-medium transition-all touch-target ${customInstructionsText.trim() ? 'bg-violet-500/10 text-violet-400 border border-violet-500/30 hover:bg-violet-500/20' : 'bg-accent/50 text-muted-foreground border border-border hover:bg-accent hover:text-foreground'} ${isMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
              title="Set custom instructions for Titan"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              {!isMobile && (customInstructionsText.trim() ? 'My Rules ✓' : 'My Rules')}
            </button>
            {isMobile && (
              <button
                onClick={handleNewConversation}
                className="p-2 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors touch-target"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages area with scroll-to-bottom */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={scrollRef}
            onClick={handleChatClick}
            data-chat-scroll
            className={`absolute inset-0 overflow-y-auto ${isMobile ? 'px-3 py-3' : 'px-4 py-4 scroll-smooth'}`}
          >
            <div className="w-full max-w-5xl mx-auto space-y-4">
              {showEmptyState ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-2">
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <TitanLogo size="xl" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Welcome to Titan</h2>
                    <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                      How can I help you today? Ask me anything — I can build, research, analyse, and assist with your projects.
                    </p>
                  </div>

                  {/* Quick actions */}
                  {quickActions && quickActions.length > 0 && (
                    <div className={`grid gap-2 max-w-lg w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSend(action.prompt)}
                          className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-all text-left group active:scale-[0.98]"
                        >
                          <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                            {QUICK_ACTION_ICONS[action.icon] || <TitanLogo size="sm" className="!h-4 !w-4" />}
                          </div>
                          <span className="text-xs font-medium leading-tight">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ─── Download App ─── */}
                  <div className="max-w-lg w-full mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Download App</h3>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                          <Download className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Titan Desktop</p>
                          <p className="text-xs text-muted-foreground">Same features as the web — plus offline mode{latestRelease ? ` • v${latestRelease.version}` : ''}</p>
                        </div>
                      </div>
                      {/* Recommended platform button */}
                      <button
                        onClick={() => handleDownloadApp(detectedPlatform)}
                        disabled={!!downloadPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold transition-all mb-2"
                      >
                        {downloadPending === detectedPlatform ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          detectedPlatform === 'windows' ? <Monitor className="h-4 w-4" /> :
                          detectedPlatform === 'mac' ? <Apple className="h-4 w-4" /> :
                          <Terminal className="h-4 w-4" />
                        )}
                        Download for {detectedPlatform === 'mac' ? 'macOS' : detectedPlatform === 'windows' ? 'Windows' : 'Linux'}
                      </button>
                      {/* Other platforms */}
                      <div className="flex items-center justify-center gap-4 mt-1">
                        {(['windows', 'mac', 'linux'] as const).filter(p => p !== detectedPlatform).map(platform => (
                          <button
                            key={platform}
                            onClick={() => handleDownloadApp(platform)}
                            disabled={!!downloadPending}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 disabled:opacity-50 transition-colors"
                          >
                            {downloadPending === platform ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              platform === 'windows' ? <Monitor className="h-3 w-3" /> :
                              platform === 'mac' ? <Apple className="h-3 w-3" /> :
                              <Terminal className="h-3 w-3" />
                            )}
                            {platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : 'Linux'}
                          </button>
                        ))}
                        {/* Android APK */}
                        <button
                          onClick={() => handleDownloadApp('android')}
                          disabled={!!downloadPending}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-cyan-400 disabled:opacity-50 transition-colors"
                        >
                          {downloadPending === 'android' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Smartphone className="h-3 w-3" />
                          )}
                          Android
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ─── Funding Features Showcase ─── */}
                  <div className="max-w-lg w-full mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Funding & Growth Tools</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => setLocation("/grants")}
                        className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-left group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <HandCoins className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Grant Finder</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Discover R&D and startup grants tailored to your business</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setLocation("/crowdfunding")}
                        className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-left group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                          <Rocket className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Crowdfunding</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Launch campaigns and rally community support for your projects</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setLocation("/affiliate")}
                        className="flex items-start gap-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-all text-left group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                          <TrendingUp className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Affiliate Program</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Earn commissions by referring users and promoting Titan tools</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setLocation("/marketplace")}
                        className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-left group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                          <Banknote className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Tech Bazaar</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Sell your code, modules, and AI systems — earn 92% of every sale</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Affiliate recommendations */}
                  <AffiliateRecommendations context="ai_chat" variant="banner" className="max-w-lg w-full mt-2" />
                </div>
              ) : (
                <>
                  {localMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 sm:gap-3 group ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                          <TitanLogo size="sm" />
                        </div>
                      )}
                      <div className="flex flex-col max-w-[85%] sm:max-w-[80%] min-w-0 overflow-hidden" style={{ overflowWrap: 'anywhere' }}>
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/50 border border-border/50 rounded-bl-md"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <>
                              {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                                <>
                                <ActionBadges actions={msg.actionsTaken} />
                                {/* Inline file cards for created files */}
                                {msg.actionsTaken.filter(a => a.tool === 'create_file' && a.success).length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {msg.actionsTaken.filter(a => a.tool === 'create_file' && a.success).map((a, fi) => {
                                      // Extract filename from summary: "Created path/to/file.ext (1.2KB)" -> "path/to/file.ext"
                                      const chipLabel = a.summary.replace(/^Created /, '').replace(/ \(.*\)$/, '');
                                      // Find the matching file in createdFiles by name
                                      const matchIdx = createdFiles.findIndex(f => f.name === chipLabel || f.name.endsWith('/' + chipLabel) || chipLabel.endsWith(f.name));
                                      return (
                                        <button
                                          key={fi}
                                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs w-full text-left hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors cursor-pointer"
                                          onClick={async () => {
                                            // Open the project files panel
                                            setShowProjectFiles(true);
                                            if (matchIdx !== -1) {
                                              const targetFile = createdFiles[matchIdx];
                                              // Toggle: if already expanded, collapse; otherwise expand
                                              setExpandedFileIdx(prev => {
                                                if (prev === matchIdx) return null;
                                                return matchIdx;
                                              });
                                              // Fetch content if not already loaded
                                              if (!filePreviewContent[matchIdx] && targetFile && !targetFile.content) {
                                                setLoadingPreview(matchIdx);
                                                try {
                                                  if (targetFile.url) {
                                                    const res = await fetch(targetFile.url, { mode: 'cors' }).catch(() => null);
                                                    if (res && res.ok) {
                                                      const text = await res.text();
                                                      setFilePreviewContent(prev => ({ ...prev, [matchIdx]: text }));
                                                    } else {
                                                      setFilePreviewContent(prev => ({ ...prev, [matchIdx]: '// Content preview unavailable — download the file to view it.' }));
                                                    }
                                                  } else {
                                                    setFilePreviewContent(prev => ({ ...prev, [matchIdx]: '// No URL available for preview.' }));
                                                  }
                                                } catch {
                                                  setFilePreviewContent(prev => ({ ...prev, [matchIdx]: '// Failed to load preview.' }));
                                                } finally {
                                                  setLoadingPreview(null);
                                                }
                                              }
                                            }
                                          }}
                                          title={`View ${chipLabel}`}
                                        >
                                          <FileText className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                          <span className="font-medium text-emerald-300 truncate">{chipLabel}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                </>
                              )}
                              <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_table]:max-w-full [&_table]:overflow-x-auto [&_img]:max-w-full">
                                <Streamdown>{msg.content}</Streamdown>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Show attached images inline in user message */}
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-2 space-y-2">
                                  {msg.attachments.filter(a => a.mimeType.startsWith('image/')).map((att, ai) => (
                                    <div key={ai} className="rounded-lg overflow-hidden border border-white/10">
                                      <img
                                        src={att.url}
                                        alt={att.name}
                                        className="max-w-full max-h-[300px] object-contain rounded-lg"
                                        loading="lazy"
                                      />
                                    </div>
                                  ))}
                                  {msg.attachments.filter(a => !a.mimeType.startsWith('image/')).map((att, ai) => (
                                    <div key={ai} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 text-xs">
                                      <Paperclip className="h-3 w-3 shrink-0" />
                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline truncate">{att.name}</a>
                                      <span className="text-white/60 shrink-0">({Math.round(att.size / 1024)}KB)</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{msg.content}</p>
                            </>
                          )}
                        </div>
                        {/* Action buttons below assistant messages */}
                        {msg.role === "assistant" && (
                          <div className="flex items-center gap-1 mt-1 ml-1">
                            <CopyButton text={msg.content} />
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Persistent Build Log — shows after build completes */}
                  {!isLoading && buildLog.length > 2 && (
                    <div className="flex gap-2 sm:gap-3 justify-start">
                      <div className="w-7 sm:w-8 shrink-0" />
                      <details className="max-w-[90%] sm:max-w-[80%] group">
                        <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1">
                          <Activity className="h-3 w-3" />
                          <span>Build log ({buildLog.filter(e => e.type === 'tool_start').length} actions)</span>
                        </summary>
                        <div className="mt-1 ml-5 space-y-0.5 border-l-2 border-border/30 pl-3 py-1">
                          {buildLog.map((evt, i) => (
                            <div key={i} className={`flex items-start gap-2 text-xs py-0.5 ${evt.reasoning ? 'bg-purple-500/5 rounded px-1 border-l-2 border-purple-500/30' : ''}`}>
                              {evt.type === 'thinking' && !evt.reasoning && (
                                <><Cpu className="h-3 w-3 text-blue-400/60 shrink-0 mt-0.5" /><span className="text-muted-foreground">{evt.message}</span></>
                              )}
                              {evt.type === 'thinking' && evt.reasoning && (
                                <><Cpu className="h-3 w-3 text-purple-400/80 shrink-0 mt-0.5" /><span className="text-purple-300/80 italic">{evt.message}</span></>
                              )}
                              {evt.type === 'tool_start' && (
                                <><Activity className="h-3 w-3 text-amber-400/60 shrink-0 mt-0.5" /><span className="text-muted-foreground">{evt.description || (evt.tool || '').replace(/_/g, ' ')}</span></>
                              )}
                              {evt.type === 'tool_result' && evt.success && (
                                <><CheckCircle2 className="h-3 w-3 text-emerald-400/60 shrink-0 mt-0.5" /><span className="text-muted-foreground">{evt.summary || 'Done'}</span></>
                              )}
                              {evt.type === 'tool_result' && !evt.success && (
                                <><XCircle className="h-3 w-3 text-red-400/60 shrink-0 mt-0.5" /><span className="text-red-400/80">{evt.summary || 'Failed'}</span></>
                              )}
                              {evt.type === 'status' && (
                                <><Cpu className="h-3 w-3 text-blue-400/60 shrink-0 mt-0.5" /><span className="text-muted-foreground">{evt.message}</span></>
                              )}
                              {evt.type === 'verification' && !evt.error && (
                                <><CheckCircle2 className="h-3 w-3 text-emerald-400/60 shrink-0 mt-0.5" /><span className="text-emerald-400/80">{evt.message || 'Verification complete'}{evt.results ? ` (${evt.results.length} checks)` : ''}</span></>
                              )}
                              {evt.type === 'verification' && evt.error && (
                                <><XCircle className="h-3 w-3 text-amber-400/60 shrink-0 mt-0.5" /><span className="text-amber-400/80">{evt.message || 'Verification failed'}: {evt.error}</span></>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Help panel */}
                  {showHelp && (
                    <div className="flex gap-2 sm:gap-3 justify-start">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                        <TitanLogo size="sm" />
                      </div>
                      <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 bg-muted/50 border border-border/50 rounded-bl-md">
                        <HelpPanel onTryCommand={(cmd) => { setShowHelp(false); handleSend(cmd); }} />
                      </div>
                    </div>
                  )}

                  {/* Loading indicator with real-time activity stream */}
                  {isLoading && (
                    <div className="flex gap-2 sm:gap-3 justify-start">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                        <TitanLogo size="sm" />
                      </div>
                      <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 sm:min-w-[300px] max-w-[90%] sm:max-w-[92%]">
                        {/* Status line */}
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                          <span className="font-medium text-xs sm:text-sm text-muted-foreground">{loadingPhase}</span>
                        </div>
                        {/* ── Titan's Inner Monologue ── always visible when reasoning events arrive */}
                        {streamEvents.filter(e => e.reasoning).length > 0 && (
                          <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Cpu className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                              <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Titan&apos;s thoughts</span>
                            </div>
                            <div className="space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-thin">
                              {streamEvents.filter(e => e.reasoning).map((evt, i) => (
                                <p key={i} className="text-sm text-purple-200 leading-relaxed italic">{evt.message}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* ── Activity feed — tool calls & status ── collapsible */}
                        {streamEvents.filter(e => !e.reasoning).length > 0 && (
                          <div>
                            <button
                              onClick={() => setShowStreamPanel(!showStreamPanel)}
                              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
                            >
                              {showStreamPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              <span>{showStreamPanel ? 'Hide' : 'Show'} activity ({streamEvents.filter(e => e.type === 'tool_start').length} actions)</span>
                            </button>
                            {showStreamPanel && (
                              <div className="space-y-1 border-t border-border/30 pt-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                                {streamEvents.filter(e => !e.reasoning).slice(-20).map((evt, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                                    {evt.type === 'thinking' && (
                                      <><Cpu className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" /><span className="text-blue-400">{evt.message || 'Thinking...'}</span></>
                                    )}
                                    {evt.type === 'tool_start' && (
                                      <><Activity className="h-3 w-3 text-amber-400 shrink-0 mt-0.5 animate-pulse" /><span className="text-amber-400">{evt.description || (evt.tool || '').replace(/_/g, ' ')}</span></>
                                    )}
                                    {evt.type === 'tool_result' && evt.success && (
                                      <><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /><span className="text-emerald-400">{evt.summary || `${(evt.tool || '').replace(/_/g, ' ')} — done`}</span></>
                                    )}
                                    {evt.type === 'tool_result' && !evt.success && (
                                      <><XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" /><span className="text-red-400">{evt.summary || `${(evt.tool || '').replace(/_/g, ' ')} — failed`}</span></>
                                    )}
                                    {evt.type === 'status' && (
                                      <><Cpu className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" /><span className="text-blue-400">{evt.message}</span></>
                                    )}
                                    {evt.type === 'verification' && !evt.error && (
                                      <><CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" /><span className="text-emerald-400 font-medium">{evt.message || 'Verification complete'}{evt.results ? ` (${evt.results.length} checks)` : ''}</span></>
                                    )}
                                    {evt.type === 'verification' && evt.error && (
                                      <><XCircle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" /><span className="text-amber-400">{evt.message || 'Verification failed'}: {evt.error}</span></>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Stop button */}
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <Button
                            onClick={async () => {
                              try {
                                if (activeConversationId) {
                                  const csrfTkn = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
                                   await fetch(`/api/chat/abort/${activeConversationId}`, { method: 'POST', credentials: 'include', headers: csrfTkn ? { 'x-csrf-token': csrfTkn } : {} });
                                }
                                if (eventSourceRef.current) {
                                  eventSourceRef.current.close();
                                  eventSourceRef.current = null;
                                }
                                setIsLoading(false);
                                setStreamEvents([]);
                                toast.info('Request cancelled');
                              } catch {
                                toast.error('Failed to cancel request');
                              }
                            }}
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                            Stop Generating
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Regenerate button */}
                  {canRegenerate && (
                    <div className="flex justify-center">
                      <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Regenerate response
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Scroll to bottom button */}
          <ScrollToBottomButton scrollRef={scrollRef as React.RefObject<HTMLDivElement>} isUserScrolledUpRef={isUserScrolledUpRef} />
        </div>

        {/* Input area */}
        <div
          className={`chat-input-area border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0 ${isMobile ? 'px-3 pt-2' : 'px-4 pt-3 pb-2'}`}
          style={voiceModeActive
            ? { paddingBottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 68px)' }
            : isMobile ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined
          }
        >
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400 font-medium">Recording... {formatDuration(recordingDuration)}</span>
              <div className="flex-1" />
              <Button onClick={stopRecording} size="sm" variant="ghost" className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/20">
                <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                Stop
              </Button>
            </div>
          )}

          {/* Transcribing indicator */}
          {isTranscribing && (
            <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary font-medium">Transcribing your voice...</span>
            </div>
          )}

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-muted/30 rounded-lg">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative group">
                  {file.type.startsWith('image/') ? (
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-border/50 bg-background">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                        className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-background px-2 py-1 rounded-md border border-border/50">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs truncate max-w-[100px] sm:max-w-[120px]">{file.name}</span>
                      <button
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                        className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Main input row */}
          <div className="relative">
            {/* Slash command autocomplete dropdown */}
            {showSlashMenu && filteredSlashCommands.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-[280px] overflow-y-auto">
                <div className="px-3 py-1.5 border-b border-border/50">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Slash Commands</span>
                </div>
                {filteredSlashCommands.map((cmd, idx) => (
                  <button
                    key={cmd.command}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      idx === slashSelectedIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                    }`}
                    onMouseEnter={() => setSlashSelectedIdx(idx)}
                    onClick={() => {
                      setInput(cmd.command);
                      setShowSlashMenu(false);
                      handleSend(cmd.command);
                    }}
                  >
                    <div className={`shrink-0 text-primary/70 ${idx === slashSelectedIdx ? 'text-primary' : ''}`}>{cmd.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cmd.command}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {cmd.action === 'navigate' ? 'Navigate' : cmd.action === 'send' ? 'Action' : 'Local'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
                    </div>
                  </button>
                ))}
                <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">↑↓ Navigate</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">Tab to select</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">Enter to run</span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground">Esc to close</span>
                </div>
              </div>
            )}

            {/* Input container with integrated buttons */}
            <div className={`flex gap-1.5 ${isMobile ? 'items-end' : 'items-end'}`}>
              {/* Action buttons — vertical stack on mobile, horizontal on desktop */}
              <div className={`flex shrink-0 ${isMobile ? 'flex-col gap-1' : 'flex-row gap-1'}`}>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading || isTranscribing}
                  className={`flex items-center justify-center rounded-xl transition-all touch-target ${
                    isMobile ? 'h-[40px] w-[40px]' : 'h-10 w-10'
                  } ${
                    isRecording
                      ? 'bg-red-500/20 text-red-400 animate-pulse ring-1 ring-red-500/50'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/50 hover:border-primary/50'
                  } disabled:opacity-50 disabled:pointer-events-none`}
                  title={isRecording ? 'Stop recording' : 'Voice input'}
                >
                  {isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
                </button>

                <button
                  onClick={handleFileUploadClick}
                  className={`flex items-center justify-center rounded-xl border border-border/50 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/50 transition-all touch-target ${
                    isMobile ? 'h-[40px] w-[40px]' : 'h-10 w-10'
                  }`}
                  title="Upload files"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.xml,.zip"
                  className="hidden"
                />

                <button
                  onClick={voiceModeActive ? exitVoiceMode : enterVoiceMode}
                  className={`flex items-center justify-center rounded-xl border transition-all touch-target ${
                    isMobile ? 'h-[40px] w-[40px]' : 'h-10 w-10'
                  } ${
                    voiceModeActive
                      ? voiceStatus === 'listening'
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 ring-1 ring-cyan-500/40 animate-pulse'
                        : voiceStatus === 'speaking'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 ring-1 ring-purple-500/40 animate-pulse'
                        : voiceStatus === 'thinking'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 ring-1 ring-amber-500/40'
                        : 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                      : 'border-border/50 text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50'
                  }`}
                  title={voiceModeActive ? 'End Voice Mode' : 'Voice Mode — talk to Titan'}
                >
                  <AudioLines className="h-4 w-4" />
                </button>
              </div>

              {/* Textarea — takes all remaining width */}
              <div className="flex-1 min-w-0">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (isMobile) {
                      // iOS keyboard takes ~300ms to fully open. Poll the visualViewport
                      // height at 100ms intervals for 600ms to catch the final keyboard height
                      // and trigger a React re-render that shrinks the chat area.
                      let polls = 0;
                      const poll = () => {
                        if (!window.visualViewport) return;
                        const vv = window.visualViewport;
                        const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                        setKeyboardHeight(kbHeight);
                        document.documentElement.style.setProperty('--keyboard-offset', `${kbHeight}px`);
                        if (scrollRef.current && !isUserScrolledUpRef.current) {
                          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }
                        polls++;
                        if (polls < 6) setTimeout(poll, 100);
                      };
                      setTimeout(poll, 100);
                    }
                  }}
                  placeholder={
                    isLoading ? 'Titan is building... type here to queue a message'
                    : isRecording ? 'Recording... tap Stop when done'
                    : isTranscribing ? 'Transcribing...'
                    : isMobile ? 'Ask Titan anything...'
                    : 'Ask Titan anything — type / for commands...'
                  }
                  className={`resize-none rounded-xl border-border/50 focus-visible:ring-primary/30 leading-relaxed ${
                    isMobile ? 'min-h-[44px] max-h-[160px] text-[16px] py-2.5 w-full' : 'min-h-[56px] max-h-[200px] text-base py-3'
                  }`}
                  rows={1}
                  disabled={isRecording || isTranscribing}
                  onBlur={() => {
                    // When keyboard is dismissed on iOS, reset the keyboard height
                    // after a short delay to allow the viewport to settle
                    if (isMobile) {
                      setTimeout(() => {
                        if (!window.visualViewport) return;
                        const vv = window.visualViewport;
                        const kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                        setKeyboardHeight(kbHeight);
                        document.documentElement.style.setProperty('--keyboard-offset', `${kbHeight}px`);
                      }, 150);
                    }
                  }}
                />
              </div>

              {/* Send + Stop buttons — both visible while Titan is running */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Queue-send button: always visible so you can send while Titan is busy */}
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isRecording || isTranscribing}
                  size="icon"
                  className={`rounded-xl touch-target transition-all ${
                    isLoading
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400'
                      : ''
                  } ${isMobile ? 'h-[44px] w-[44px]' : 'h-10 w-10'}`}
                  title={isLoading ? 'Inject mid-task — Titan reads this immediately' : 'Send message'}
                >
                  {isLoading ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
                {/* Stop button: only visible while Titan is running */}
                {isLoading && (
                  <Button
                    onClick={async () => {
                      try {
                        if (activeConversationId) {
                          const csrfTkn = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
                          await fetch(`/api/chat/abort/${activeConversationId}`, { method: 'POST', credentials: 'include', headers: csrfTkn ? { 'x-csrf-token': csrfTkn } : {} });
                        }
                        if (eventSourceRef.current) {
                          eventSourceRef.current.close();
                          eventSourceRef.current = null;
                        }
                        setIsLoading(false);
                        setStreamEvents([]);
                        toast.info('Titan stopped');
                      } catch {
                        toast.error('Failed to stop');
                      }
                    }}
                    size="icon"
                    className={`rounded-xl touch-target bg-red-600 hover:bg-red-700 text-white animate-pulse ${isMobile ? 'h-[44px] w-[44px]' : 'h-10 w-10'}`}
                    title="Stop Titan"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Mid-run injection hint — shown while Titan is processing */}
          {isLoading && (
            <div className="mt-1.5 flex items-center gap-1.5 px-1">
              <Zap className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-[10px] text-amber-400">
                Titan is working — type a message and he’ll read it mid-task without stopping
              </span>
            </div>
          )}

          {/* Footer hint — hidden on mobile to save space */}
          {!isMobile && (
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              <button onClick={isRecording ? stopRecording : startRecording} className="text-primary hover:underline cursor-pointer">
                <Mic className="h-3 w-3 inline-block mr-0.5 -mt-0.5" />Voice
              </button>
              {' · '}
              <button onClick={voiceModeActive ? exitVoiceMode : enterVoiceMode} className={`hover:underline cursor-pointer ${voiceModeActive ? 'text-cyan-400 font-medium' : 'text-purple-400'}`}>
                <AudioLines className="h-3 w-3 inline-block mr-0.5 -mt-0.5" />{voiceModeActive ? 'Voice On ●' : 'Voice Mode'}
              </button>
              {' · '}
              <button onClick={() => handleSend('/help')} className="text-primary hover:underline cursor-pointer">/help</button>
              {' · Conversations saved automatically · Powered by AI'}
            </p>
          )}
          <div className={`flex justify-center ${isMobile ? 'mt-1' : 'mt-2'}`}>
            <LeegoLogo idleClassName={isMobile ? 'h-14 w-14' : 'h-24 w-24'} />
          </div>
        </div>
      </div>
      {/* Token Input Panel */}
      {showTokenInput && (
        <div className={`${isMobile ? 'fixed inset-0 z-50 bg-background' : 'fixed right-0 top-0 bottom-0 w-[360px] border-l border-border'} flex flex-col bg-background`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <h3 className="font-semibold text-sm">API Tokens & Keys</h3>
            </div>
            <button onClick={() => setShowTokenInput(false)} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-xs text-muted-foreground">Add API tokens here for the builder to use in your projects. These are saved securely and accessible by the AI when building.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Token Name</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. OpenAI API Key, Stripe Secret..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Token Value</label>
                <input
                  type="password"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder="sk-... or pk_live_..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <Button
                onClick={async () => {
                  if (!tokenName.trim() || !tokenValue.trim()) {
                    toast.error('Both name and value are required');
                    return;
                  }
                  try {
                    // Save to user's personal secrets vault via tRPC (works for ALL plans)
                    // Read CSRF token from cookie (double-submit cookie pattern)
                    const csrfToken = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
                    const resp = await fetch('/api/trpc/userSecrets.saveToken', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken,
                      },
                      credentials: 'include',
                      body: JSON.stringify({
                        json: {
                          name: tokenName.trim(),
                          value: tokenValue.trim(),
                          credentialType: 'api_token',
                          notes: 'Manually added via Builder token input',
                        },
                      }),
                    });
                    if (!resp.ok) {
                      const errData = await resp.json().catch(() => ({}));
                      throw new Error(errData?.error?.json?.message || errData?.error?.message || 'Failed to save token');
                    }
                    const preview = tokenValue.length > 10
                      ? tokenValue.substring(0, 6) + '...' + tokenValue.substring(tokenValue.length - 4)
                      : '••••••';
                    // Reload tokens from DB to get the real list with IDs
                    fetch('/api/trpc/userSecrets.listTokens', { credentials: 'include' })
                      .then(r => r.json())
                      .then(data => {
                        // tRPC v10 batch responses are arrays: [{result:{data:{json:[...]}}}]
                        const batchData = Array.isArray(data) ? data[0] : data;
                        const tokens = batchData?.result?.data?.json || [];
                        setSavedTokens(tokens.map((t: any) => ({
                          id: t.id,
                          name: t.label?.split(' (')[0] || t.secretType,
                          preview: t.label?.match(/\((.+)\)/)?.[1] || t.secretType,
                        })));
                      })
                      .catch(() => {
                        // Fallback: add to local state
                        setSavedTokens(prev => [...prev, { id: Date.now(), name: tokenName, preview }]);
                      });
                    setTokenName('');
                    setTokenValue('');
                    toast.success(`Token "${tokenName}" saved to vault`);
                  } catch (err: any) {
                    if (err?.message?.includes('feature')) {
                      toast.error('Vault requires a paid plan. Upgrade to save tokens.');
                    } else {
                      toast.error('Failed to save token: ' + (err?.message || 'Unknown error'));
                    }
                  }
                }}
                disabled={!tokenName.trim() || !tokenValue.trim()}
                size="sm"
                className="w-full gap-2"
              >
                <Save className="h-3.5 w-3.5" />
                Save Token
              </Button>
            </div>
            {loadingTokens && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-amber-400 mr-2" />
                <span className="text-xs text-muted-foreground">Loading saved tokens...</span>
              </div>
            )}
            {!loadingTokens && savedTokens.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-medium text-muted-foreground">Saved Tokens ({savedTokens.length})</h4>
                {savedTokens.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center gap-2">
                      <Key className="h-3.5 w-3.5 text-amber-400" />
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{t.preview}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const csrfTk = document.cookie.split('; ').find(c => c.startsWith('csrf_token='))?.split('=')[1] || '';
                        try {
                          await fetch('/api/trpc/userSecrets.deleteToken', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfTk },
                            credentials: 'include',
                            body: JSON.stringify({ json: { id: t.id } }),
                          });
                          setSavedTokens(prev => prev.filter((_, idx) => idx !== i));
                          toast.success('Token deleted');
                        } catch { toast.error('Failed to delete token'); }
                      }}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">Tokens are encrypted and stored in your secure vault. The builder can access them when building projects that need API integrations. You can also say "use my OpenAI key" in chat and the builder will pull it from your vault.</p>
            </div>
          </div>
        </div>
      )}
      {/* Custom Instructions Panel */}
      {showCustomInstructions && (
        <div className={`${isMobile ? 'fixed inset-0 z-50 bg-background' : 'fixed right-0 top-0 bottom-0 w-[400px] border-l border-border'} flex flex-col bg-background`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-400" />
              <h3 className="font-semibold text-sm">My Rules for Titan</h3>
            </div>
            <button onClick={() => setShowCustomInstructions(false)} className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-1">
              <p className="text-xs font-medium text-violet-400">What you can control</p>
              <p className="text-[11px] text-muted-foreground">Set preferences for how Titan responds — output style, verification steps, project structure, language preferences, and anything about how you like to work.</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <p className="text-xs font-medium text-amber-400">Platform rules always take priority</p>
              <p className="text-[11px] text-muted-foreground">Your instructions are applied after all system rules. They cannot override security settings, platform behaviour, or admin configuration. Any instruction that conflicts with platform rules is silently ignored.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Your instructions</label>
              <textarea
                value={customInstructionsText}
                onChange={e => { setCustomInstructionsText(e.target.value); setCustomInstructionsSaved(false); }}
                placeholder={`Examples:\n• Always provide complete, working projects — no partial code\n• Verify functionality of every build before marking it done\n• Use TypeScript strict mode in all projects\n• Always include a README with setup instructions\n• Prefer functional components over class components`}
                className="w-full h-48 rounded-lg border border-border bg-background text-sm p-3 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/50 placeholder:text-muted-foreground/50"
                maxLength={2000}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{customInstructionsText.length}/2000 characters</span>
                {customInstructionsSaved && <span className="text-[10px] text-emerald-400">Saved ✓</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await saveCustomInstructionsMutation.mutateAsync({ customInstructions: customInstructionsText.trim() || null });
                  setCustomInstructionsSaved(true);
                }}
                disabled={saveCustomInstructionsMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium py-2 transition-colors disabled:opacity-50"
              >
                {saveCustomInstructionsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saveCustomInstructionsMutation.isPending ? 'Saving...' : 'Save Instructions'}
              </button>
              {customInstructionsText.trim() && (
                <button
                  onClick={async () => {
                    setCustomInstructionsText('');
                    await saveCustomInstructionsMutation.mutateAsync({ customInstructions: null });
                    setCustomInstructionsSaved(true);
                  }}
                  className="px-3 rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive text-muted-foreground text-xs transition-colors"
                  title="Clear all instructions"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Files Panel with Preview */}
      {/* Builder History Panel (#32) */}
      {showBuilderHistory && buildLog.length > 0 && (
        <div className={`${isMobile ? 'fixed inset-0 z-50 bg-background' : 'fixed right-0 top-0 bottom-0 w-[420px] border-l border-border'} flex flex-col bg-background`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-red-400" />
              <h3 className="font-semibold text-sm">Builder Action Log</h3>
              <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">{buildLog.filter(e => e.type === 'tool_start').length} actions</Badge>
            </div>
            <button
              onClick={() => setShowBuilderHistory(false)}
              className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {buildLog.map((evt, idx) => (
              <div key={idx} className={`rounded-lg border px-3 py-2 text-xs ${
                evt.type === 'tool_start' ? 'border-blue-500/20 bg-blue-500/5' :
                evt.type === 'tool_result' ? (evt.success ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5') :
                evt.type === 'verification' ? 'border-amber-500/20 bg-amber-500/5' :
                (evt.type === 'thinking' && evt.reasoning) ? 'border-purple-500/30 bg-purple-500/5' :
                'border-border/30 bg-card'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {evt.type === 'tool_start' && <Terminal className="h-3 w-3 text-blue-400 shrink-0" />}
                  {evt.type === 'tool_result' && (evt.success
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    : <XCircle className="h-3 w-3 text-red-400 shrink-0" />)}
                  {evt.type === 'thinking' && !evt.reasoning && <Activity className="h-3 w-3 text-muted-foreground shrink-0" />}
                  {evt.type === 'thinking' && evt.reasoning && <Cpu className="h-3 w-3 text-purple-400 shrink-0" />}
                  {evt.type === 'verification' && <ScanLine className="h-3 w-3 text-amber-400 shrink-0" />}
                  <span className={`font-mono font-medium truncate ${evt.type === 'thinking' && evt.reasoning ? 'text-purple-400' : ''}`}>
                    {evt.reasoning ? 'Titan\'s reasoning' : (evt.tool ? evt.tool.replace(/_/g, ' ') : evt.type)}
                  </span>
                  <span className="ml-auto text-muted-foreground shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {(evt.description || evt.summary || evt.message) && (
                  <p className={`leading-relaxed ${evt.reasoning ? 'text-purple-300 italic' : 'text-muted-foreground'}`}>
                    {evt.description || evt.summary || evt.message}
                  </p>
                )}
                {evt.preview && (
                  <pre className="mt-1 text-[10px] font-mono bg-black/20 rounded p-1.5 overflow-x-auto max-h-20 text-emerald-300">{evt.preview}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showProjectFiles && createdFiles.length > 0 && (
        <div className={`${isMobile ? 'fixed inset-0 z-50 bg-background' : 'fixed right-0 top-0 bottom-0 w-[420px] border-l border-border'} flex flex-col bg-background`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-sm">Project Files</h3>
              <Badge variant="outline" className="text-[10px]">{createdFiles.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const allContent = createdFiles.map(f => `// === ${f.name} ===\n// Download: ${f.url}`).join('\n\n');
                  navigator.clipboard.writeText(allContent);
                  toast.success('File list copied');
                }}
                className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy all file links"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setShowProjectFiles(false); setExpandedFileIdx(null); }}
                className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {createdFiles.map((file, idx) => (
              <div key={idx} className={`rounded-xl border transition-all ${expandedFileIdx === idx ? 'border-primary/50 bg-card' : 'border-border/50 bg-card hover:bg-accent/30'}`}>
                <div
                  className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                  onClick={async () => {
                    if (expandedFileIdx === idx) {
                      setExpandedFileIdx(null);
                      return;
                    }
                    setExpandedFileIdx(idx);
                    // Fetch content if not already loaded
                    if (!filePreviewContent[idx] && !file.content) {
                      setLoadingPreview(idx);
                      try {
                        if (file.url) {
                          const res = await fetch(file.url, { mode: 'cors' }).catch(() => null);
                          if (res && res.ok) {
                            const text = await res.text();
                            setFilePreviewContent(prev => ({ ...prev, [idx]: text }));
                          } else {
                            setFilePreviewContent(prev => ({ ...prev, [idx]: '// Content preview unavailable — download the file to view it.' }));
                          }
                        } else {
                          setFilePreviewContent(prev => ({ ...prev, [idx]: '// No URL available for preview.' }));
                        }
                      } catch {
                        setFilePreviewContent(prev => ({ ...prev, [idx]: '// Failed to load preview.' }));
                      } finally {
                        setLoadingPreview(null);
                      }
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {file.language} · {file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedFileIdx(expandedFileIdx === idx ? null : idx); }}
                      className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="Preview file"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {file.url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open Save As modal — pre-fill with the file's base name (no extension)
                          const baseName = file.name.replace(/\.[^.]+$/, '') || 'project-files';
                          setSaveAsFilename(baseName);
                          setSaveAsPendingAction('single');
                          setSaveAsSingleFileUrl(file.url);
                          setSaveAsSingleFileName(file.name);
                          setSaveAsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Save As"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Expandable file content preview */}
                {expandedFileIdx === idx && (
                  <div className="border-t border-border/30">
                    {loadingPreview === idx ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="ml-2 text-xs text-muted-foreground">Loading preview...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute top-2 right-2 z-10 flex gap-1">
                          <button
                            onClick={() => {
                              const content = file.content || filePreviewContent[idx] || '';
                              navigator.clipboard.writeText(content);
                              toast.success('File content copied');
                            }}
                            className="p-1 rounded bg-background/80 border border-border/50 hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy content"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <pre className="p-3 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin bg-muted/30 rounded-b-xl">
                          <code>{file.content || filePreviewContent[idx] || '// No content available'}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3 space-y-2">
            <Button
              onClick={() => {
                // Open Save As modal — pre-fill with a smart default based on first file name or conversation id
                const firstFile = createdFiles[0]?.name ?? '';
                const topFolder = firstFile.includes('/') ? firstFile.split('/')[0] : '';
                const defaultName = topFolder
                  ? topFolder.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
                  : activeConversationId
                    ? `project-${activeConversationId}`
                    : 'project-files';
                setSaveAsFilename(defaultName);
                setSaveAsPendingAction('all');
                setSaveAsSingleFileUrl(null);
                setSaveAsSingleFileName('');
                setSaveAsModalOpen(true);
              }}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download All ({createdFiles.length} files)
            </Button>
            <Button
              onClick={() => handleSend('Push all project files to GitHub. Create a new repository if needed.')}
              variant="default"
              size="sm"
              className="w-full gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Push to GitHub
            </Button>
          </div>
        </div>
      )}

      {/* Save As Modal — shown before ZIP download so user can name the file */}
      {saveAsModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          style={{ backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSaveAsModalOpen(false); }}
        >
          <div className="bg-background border border-border rounded-2xl shadow-2xl p-6 w-[90vw] max-w-sm mx-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Save As</h3>
              <button
                onClick={() => setSaveAsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">File name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={saveAsFilename}
                  onChange={(e) => setSaveAsFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('save-as-confirm-btn')?.click();
                    }
                    if (e.key === 'Escape') setSaveAsModalOpen(false);
                  }}
                  className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus
                  spellCheck={false}
                />
                <span className="text-xs text-muted-foreground shrink-0">.zip</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setSaveAsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
              >
                Cancel
              </button>
              <button
                id="save-as-confirm-btn"
                onClick={async () => {
                  const finalName = (saveAsFilename.trim() || 'project-files') + '.zip';
                  setSaveAsModalOpen(false);
                  if (saveAsPendingAction === 'single' && saveAsSingleFileUrl) {
                    // Single file fallback zip
                    try {
                      const s3Res = await fetch(saveAsSingleFileUrl, { mode: 'cors' }).catch(() => null);
                      if (s3Res && s3Res.ok) {
                        const fileBlob = await s3Res.blob();
                        saveAs(new Blob([fileBlob], { type: 'application/octet-stream' }), saveAsSingleFileName || finalName);
                      } else {
                        const dlUrl = activeConversationId
                          ? `/api/project-files/download-zip?conversationId=${activeConversationId}`
                          : '/api/project-files/download-zip?all=true';
                        const zipRes = await fetch(dlUrl, { credentials: 'include' });
                        if (zipRes.ok) {
                          const zipBlob = await zipRes.blob();
                          saveAs(zipBlob, finalName);
                          toast.info('Downloaded as ' + finalName);
                        } else {
                          toast.error('Download failed');
                        }
                      }
                    } catch { toast.error('Download failed'); }
                  } else {
                    // Download All zip
                    try {
                      toast.info('Preparing ' + finalName + '...');
                      const downloadUrl = activeConversationId
                        ? `/api/project-files/download-zip?conversationId=${activeConversationId}`
                        : '/api/project-files/download-zip?all=true';
                      const res = await fetch(downloadUrl, { credentials: 'include' });
                      if (res.ok) {
                        const blob = await res.blob();
                        saveAs(blob, finalName);
                        toast.success(`Downloaded ${createdFiles.length} files as ${finalName}`);
                      } else {
                        const err = await res.json().catch(() => ({ error: 'Download failed' }));
                        toast.error(err.error || 'Download failed');
                      }
                    } catch { toast.error('Download failed — please try again'); }
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Mode Bar — compact floating bar above input, chat stays fully visible */}
      {voiceModeActive && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-[90] flex items-center gap-3 px-4 py-3 border-t transition-all duration-300 ${
            voiceStatus === 'listening'
              ? 'bg-cyan-950/95 border-cyan-500/40'
              : voiceStatus === 'speaking'
              ? 'bg-purple-950/95 border-purple-500/40'
              : voiceStatus === 'thinking'
              ? 'bg-amber-950/95 border-amber-500/40'
              : 'bg-background/95 border-border/50'
          }`}
          style={{ backdropFilter: 'blur(16px)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {/* Titan logo with status glow */}
          <div className={`relative h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
            voiceStatus === 'listening'
              ? 'ring-2 ring-cyan-500/70 shadow-[0_0_14px_rgba(0,200,255,0.4)]'
              : voiceStatus === 'speaking'
              ? 'ring-2 ring-purple-500/70 shadow-[0_0_14px_rgba(168,85,247,0.4)] animate-pulse'
              : voiceStatus === 'thinking'
              ? 'ring-2 ring-amber-500/70 shadow-[0_0_14px_rgba(245,158,11,0.3)]'
              : 'ring-1 ring-border/50'
          }`}>
            <img src={AT_ICON_FULL} alt="Titan" className="h-8 w-8 object-contain rounded-full" draggable={false} />
          </div>

          {/* Status + waveform */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {voiceStatus === 'listening' && (
              <>
                {/* Animated waveform bars */}
                <div className="flex items-center gap-[3px] shrink-0">
                  {[0.6, 1.0, 0.75, 1.0, 0.5, 0.85, 0.65].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-cyan-400 rounded-full animate-pulse"
                      style={{
                        height: `${10 + h * 14}px`,
                        animationDelay: `${i * 0.12}s`,
                        animationDuration: '0.55s',
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-cyan-300 shrink-0">Listening</span>
                {recordingDuration > 0 && (
                  <span className="text-xs text-cyan-400/70 shrink-0">{formatDuration(recordingDuration)}</span>
                )}
              </>
            )}
            {voiceStatus === 'thinking' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
                <span className="text-sm font-medium text-amber-300">Titan is thinking...</span>
              </>
            )}
            {voiceStatus === 'speaking' && (
              <>
                <div className="flex items-center gap-[3px] shrink-0">
                  {[0.5, 0.9, 0.7, 1.0, 0.6, 0.8, 0.55].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-purple-400 rounded-full animate-pulse"
                      style={{
                        height: `${8 + h * 14}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.45s',
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-purple-300">Titan is speaking...</span>
              </>
            )}
            {voiceStatus === 'idle' && (
              <>
                <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Voice mode active — tap mic to speak</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {voiceStatus === 'idle' && (
              <button
                onClick={() => { startRecording(); setVoiceStatus('listening'); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm font-medium"
                style={{ touchAction: 'manipulation', minHeight: 40 }}
              >
                <Mic className="h-4 w-4" />
                {!isMobile && 'Speak'}
              </button>
            )}
            {voiceStatus === 'listening' && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 active:bg-red-500/50 transition-all text-sm font-medium"
                style={{ touchAction: 'manipulation', minHeight: 40 }}
                aria-label="Stop recording"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {!isMobile && 'Stop'}
              </button>
            )}
            {voiceStatus === 'speaking' && (
              <button
                onClick={() => {
                  stopTtsPlayback();
                  setIsSpeaking(false);
                  setVoiceStatus('idle');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted transition-all text-sm font-medium"
                style={{ minHeight: 40 }}
              >
                <VolumeX className="h-4 w-4" />
                {!isMobile && 'Skip'}
              </button>
            )}
            {/* Hang up */}
            <button
              onClick={exitVoiceMode}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-all text-sm font-medium"
              style={{ touchAction: 'manipulation', minHeight: 40 }}
              aria-label="End voice mode"
            >
              <PhoneOff className="h-4 w-4" />
              {!isMobile && 'End'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
