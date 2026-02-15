import { useState, useRef, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
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
} from "lucide-react";
import { Streamdown } from "streamdown";
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

// ─── Help Command Content ──────────────────────────────────────────
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
      "Activate emergency kill switch",
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
      "Navigate to any page — just say \"take me to...\"",
      "2FA Setup → /fetcher/account",
      "Credentials → /fetcher/credentials",
      "Auto-Sync → /fetcher/auto-sync",
      "Leak Scanner → /fetcher/leak-scanner",
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
];

const HELP_ICONS: Record<string, React.ReactNode> = {
  code2: <Code2 className="h-4 w-4" />,
  keyrnd: <KeyRound className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
  navigation: <Navigation className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
};

function HelpPanel({ onTryCommand }: { onTryCommand: (cmd: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">Titan Assistant — What I Can Do</h3>
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
  activate_kill_switch: "Activated kill switch",
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

interface ChatMsg {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  actionsTaken?: Array<{ tool: string; success: boolean; summary: string }> | null;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }> | null;
}

// ─── Action Badge Component ──────────────────────────────────────────
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

// ─── Conversation Sidebar ────────────────────────────────────────────
function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  collapsed,
  onToggle,
}: {
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: convData, refetch } = trpc.chat.listConversations.useQuery(
    search ? { search } : undefined,
    { refetchOnWindowFocus: false }
  );

  const renameMutation = trpc.chat.renameConversation.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
    },
  });
  const deleteMutation = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Conversation deleted");
    },
  });
  const pinMutation = trpc.chat.pinConversation.useMutation({
    onSuccess: () => refetch(),
  });
  const archiveMutation = trpc.chat.archiveConversation.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Conversation archived");
    },
  });

  const conversations = convData?.conversations ?? [];

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border/50 flex flex-col items-center py-3 gap-2 shrink-0">
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
    <div className="w-64 border-r border-border/50 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conversations</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
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
                {conv.pinned === 1 && (
                  <Pin className="h-3 w-3 text-amber-400 shrink-0" />
                )}
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {editingId === conv.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => {
                      if (editTitle.trim()) {
                        renameMutation.mutate({
                          conversationId: conv.id,
                          title: editTitle.trim(),
                        });
                      }
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editTitle.trim()) {
                        renameMutation.mutate({
                          conversationId: conv.id,
                          title: editTitle.trim(),
                        });
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 bg-transparent text-xs border-b border-primary outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-xs truncate">{conv.title}</span>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-background/50 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditTitle(conv.title);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        pinMutation.mutate({
                          conversationId: conv.id,
                          pinned: conv.pinned !== 1,
                        });
                      }}
                    >
                      {conv.pinned === 1 ? (
                        <>
                          <PinOff className="h-3.5 w-3.5 mr-2" />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5 mr-2" />
                          Pin
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveMutation.mutate({
                          conversationId: conv.id,
                          archived: true,
                        });
                      }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this conversation?")) {
                          deleteMutation.mutate({ conversationId: conv.id });
                        }
                      }}
                    >
                      <Trash className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground text-center">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Main Chat Page ──────────────────────────────────────────────────
export default function ChatPage() {
  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("Thinking...");
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  // Intercept internal navigation links in chat messages
  const handleChatClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    // Only intercept internal links (starting with /)
    if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      setLocation(href);
    }
  };
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribeMutation = trpc.voice.transcribe.useMutation();

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
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        // Clear timer
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

        // Upload and transcribe
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          // Upload audio to S3
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording.${mimeType.includes('webm') ? 'webm' : 'm4a'}`);

          const uploadRes = await fetch('/api/voice/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({ error: 'Upload failed' }));
            throw new Error(err.error || 'Failed to upload audio');
          }

          const { url: audioUrl } = await uploadRes.json();

          // Transcribe
          const result = await transcribeMutation.mutateAsync({ audioUrl });

          if (result.text && result.text.trim()) {
            // Auto-send the transcribed text
            handleSend(result.text.trim());
          } else {
            toast.error('Could not understand the audio. Please try again.');
          }
        } catch (err: any) {
          console.error('[Voice] Transcription error:', err);
          toast.error(err.message || 'Voice transcription failed. Please try again.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);
      setRecordingDuration(0);

      // Duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast.success('Recording started. Tap the stop button when done.');
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Load conversation messages when active conversation changes
  const { data: convDetail, refetch: refetchConv } =
    trpc.chat.getConversation.useQuery(
      { conversationId: activeConversationId! },
      {
        enabled: !!activeConversationId,
        refetchOnWindowFocus: false,
      }
    );

  const { data: quickActions } = trpc.chat.quickActions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const sendMutation = trpc.chat.send.useMutation();
  const utils = trpc.useUtils();

  // Sync DB messages into local state
  useEffect(() => {
    if (convDetail?.messages) {
      setLocalMessages(
        convDetail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          actionsTaken: m.actionsTaken,
          toolCalls: m.toolCalls,
        }))
      );
    }
  }, [convDetail]);

  // Clear local messages when switching to new conversation
  useEffect(() => {
    if (!activeConversationId) {
      setLocalMessages([]);
    }
  }, [activeConversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [localMessages, isLoading]);

  // Cycle loading phase text
  useEffect(() => {
    if (!isLoading) return;
    const phases = [
      "Thinking...",
      "Analyzing request...",
      "Executing actions...",
      "Processing results...",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setLoadingPhase(phases[idx]);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    // Handle slash commands
    const lowerText = messageText.toLowerCase().trim();
    const slashCmd = SLASH_COMMANDS.find(c => c.command === lowerText);
    setShowSlashMenu(false);

    if (lowerText === '/help' || lowerText === 'help') {
      setInput('');
      setShowHelp(true);
      const helpUserMsg: ChatMsg = { id: -Date.now(), role: 'user', content: messageText, createdAt: Date.now() };
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
      setShowHelp(false);
      toast.success('Chat cleared');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    // Navigation commands
    if (slashCmd?.action === 'navigate' && slashCmd.path) {
      setInput('');
      setLocation(slashCmd.path);
      toast.success(`Navigating to ${slashCmd.label}`);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    // Commands that send a prompt to the assistant
    if (slashCmd?.action === 'send' && slashCmd.prompt) {
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      // Recursively call with the prompt text (not the slash command)
      handleSend(slashCmd.prompt);
      return;
    }

    // Hide help panel when sending a real message
    setShowHelp(false);

    // Optimistic user message
    const tempId = -Date.now();
    const userMsg: ChatMsg = {
      id: tempId,
      role: "user",
      content: messageText,
      createdAt: Date.now(),
    };

    setLocalMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setLoadingPhase("Thinking...");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const result = await sendMutation.mutateAsync({
        message: messageText,
        conversationId: activeConversationId || undefined,
      });

      // If this was a new conversation, set the active ID
      if (!activeConversationId && result.conversationId) {
        setActiveConversationId(result.conversationId);
        // Refresh conversation list
        utils.chat.listConversations.invalidate();
      }

      // Add assistant message
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
                }
              }
              return { tool: a.tool, success: a.success, summary };
            })
          : null,
      };

      setLocalMessages((prev) => [...prev, assistantMsg]);

      // Show toast for executed actions
      if (result.actions && result.actions.length > 0) {
        const successCount = result.actions.filter(
          (a: ExecutedAction) => a.success
        ).length;
        const failCount = result.actions.length - successCount;
        if (failCount === 0) {
          toast.success(
            `${successCount} action${successCount > 1 ? "s" : ""} completed`
          );
        } else {
          toast.warning(`${successCount} succeeded, ${failCount} failed`);
        }
      }

      // Refresh conversation list to update last message time
      utils.chat.listConversations.invalidate();
    } catch (err) {
      toast.error("Failed to get response. Please try again.");
      setLocalMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setLocalMessages([]);
  };

  const handleSelectConversation = (id: number) => {
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

    // Slash command autocomplete
    if (val.startsWith('/')) {
      const filter = val.toLowerCase();
      setSlashFilter(filter);
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

  return (
    <div className={`chat-page-root flex ${isMobile ? 'h-[calc(100dvh-3.5rem)]' : 'h-[calc(100vh-3rem)]'}`}>
      {/* Conversation Sidebar - hidden on mobile, use main nav sidebar instead */}
      {!isMobile && (
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Titan Assistant
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Executes real actions on your behalf
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/30 text-amber-400 ml-1"
            >
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              Actions Enabled
            </Badge>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          onClick={handleChatClick}
          className="flex-1 overflow-y-auto py-4 px-4 space-y-4 scroll-smooth"
        >
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">
                  How can I help you?
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  I can execute real actions on your Titan account — list
                  credentials, create API keys, scan for leaks, manage your
                  team, modify code, and more.
                </p>
              </div>

              {/* Quick actions */}
              {quickActions && quickActions.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleSend(action.prompt)}
                      className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 transition-all text-left group"
                    >
                      <div className="text-muted-foreground group-hover:text-primary transition-colors">
                        {QUICK_ACTION_ICONS[action.icon] || (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <span className="text-xs font-medium">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {localMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/50 border border-border/50 rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <>
                        {msg.actionsTaken &&
                          msg.actionsTaken.length > 0 && (
                            <ActionBadges actions={msg.actionsTaken} />
                          )}
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}

              {/* Help panel */}
              {showHelp && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 bg-muted/50 border border-border/50 rounded-bl-md">
                    <HelpPanel onTryCommand={(cmd) => { setShowHelp(false); handleSend(cmd); }} />
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted/50 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{loadingPhase}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input area */}
        <div className={`px-4 pt-3 border-t border-border/50 ${isMobile ? 'pb-4' : 'pb-2'}`}>
          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400 font-medium">Recording... {formatDuration(recordingDuration)}</span>
              <div className="flex-1" />
              <Button
                onClick={stopRecording}
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              >
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

          <div className="flex items-end gap-2">
            {/* Mic button */}
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || isTranscribing}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className={`h-11 w-11 rounded-xl shrink-0 transition-all ${
                isRecording
                  ? 'animate-pulse ring-2 ring-red-500/50'
                  : 'hover:bg-primary/10 hover:text-primary hover:border-primary/50'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
            </Button>

            <div className="flex-1 relative">
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
                      <div className={`shrink-0 text-primary/70 ${
                        idx === slashSelectedIdx ? 'text-primary' : ''
                      }`}>{cmd.icon}</div>
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
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Recording... tap Stop when done' : isTranscribing ? 'Transcribing...' : 'Ask Titan anything — type / for commands...'}
                className="resize-none min-h-[52px] max-h-[200px] pr-12 rounded-xl border-border/50 focus-visible:ring-primary/30 text-base md:text-sm"
                rows={1}
                disabled={isLoading || isRecording || isTranscribing}
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading || isRecording || isTranscribing}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            <button onClick={isRecording ? stopRecording : startRecording} className="text-primary hover:underline cursor-pointer"><Mic className="h-3 w-3 inline-block mr-0.5 -mt-0.5" />Voice</button> · <button onClick={() => handleSend('/help')} className="text-primary hover:underline cursor-pointer">/help</button> · Conversations saved automatically · Powered by AI
          </p>
        </div>
      </div>
    </div>
  );
}
