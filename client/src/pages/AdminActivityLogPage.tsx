/**
 * Admin Activity Log Page
 *
 * Visible ONLY to admin and head_admin users.
 * Shows all admin actions including specialised tool usage,
 * user management, subscription grants, and system operations.
 *
 * This page is NOT linked from the regular sidebar — it is only
 * accessible via the Admin Panel navigation.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";
import { format } from "date-fns";
import {
  Shield,
  Download,
  RefreshCw,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  CreditCard,
  Wrench,
  Package,
  Settings,
  Lock,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  user_management: { label: "User Management", icon: <Users className="w-3.5 h-3.5" />, color: "text-blue-400 bg-blue-400/10" },
  subscription: { label: "Subscription", icon: <CreditCard className="w-3.5 h-3.5" />, color: "text-green-400 bg-green-400/10" },
  specialised_tools: { label: "Specialised Tools", icon: <Wrench className="w-3.5 h-3.5" />, color: "text-red-400 bg-red-400/10" },
  releases: { label: "Releases", icon: <Package className="w-3.5 h-3.5" />, color: "text-purple-400 bg-purple-400/10" },
  self_improvement: { label: "Self Improvement", icon: <Settings className="w-3.5 h-3.5" />, color: "text-yellow-400 bg-yellow-400/10" },
  system: { label: "System", icon: <Settings className="w-3.5 h-3.5" />, color: "text-gray-400 bg-gray-400/10" },
  security: { label: "Security", icon: <Lock className="w-3.5 h-3.5" />, color: "text-orange-400 bg-orange-400/10" },
};

const PAGE_SIZE = 50;

export default function AdminActivityLogPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");

  // Guard: only admins can see this page
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "head_admin") {
    return <Redirect to="/" />;
  }

  const { data, isLoading, refetch } = trpc.adminActivityLog.list.useQuery({
    search: search || undefined,
    category: (category as any) || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const { data: stats } = trpc.adminActivityLog.stats.useQuery();

  const exportCsv = trpc.adminActivityLog.exportCsv.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <Shield className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Activity Log</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              All admin actions — visible to admins only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => exportCsv.mutate({ category: (category as any) || undefined })}
            disabled={exportCsv.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Last 24h", value: stats.last24h, icon: <Clock className="w-4 h-4" /> },
            { label: "Last 7 days", value: stats.last7d, icon: <Clock className="w-4 h-4" /> },
            { label: "Last 30 days", value: stats.last30d, icon: <Clock className="w-4 h-4" /> },
            { label: "Specialised Tools", value: stats.specialisedTotal, icon: <Wrench className="w-4 h-4" /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                {stat.icon}
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by action, admin email, or target..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1"
          />
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(0); }}
            className="bg-transparent text-sm text-white outline-none"
          >
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-colors"
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data || data.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Shield className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No admin activity found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium">Admin</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Target</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log: any, i: number) => {
                  const cat = CATEGORY_LABELS[log.category] || { label: log.category, icon: null, color: "text-gray-400 bg-gray-400/10" };
                  const ts = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
                  return (
                    <tr
                      key={log.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                    >
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">
                        {format(ts, "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-xs font-medium">{log.adminEmail || `#${log.adminId}`}</div>
                        <div className="text-gray-500 text-xs">{log.adminRole}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-cyan-300 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${cat.color}`}>
                          {cat.icon}
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {log.targetUserEmail || (log.targetUserId ? `#${log.targetUserId}` : "—")}
                      </td>
                      <td className="px-4 py-3">
                        {log.success ? (
                          <span className="flex items-center gap-1 text-green-400 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" />
                            OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-xs" title={log.errorMessage || ""}>
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                        {log.ipAddress || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="mt-6 flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          This log is only visible to admin and head_admin users. It is stored in a separate database table
          and is never included in user-facing API responses. Regular users cannot access or enumerate this data.
        </span>
      </div>
    </div>
  );
}
