import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchAuditLogs } from './services/adminApi';
import { ScrollText, ChevronLeft, ChevronRight, Shield, UserMinus, Search } from 'lucide-react';

/**
 * Admin Audit Logs Page
 * Displays a chronological trail of admin actions (role changes, user deletions)
 * for accountability and forensics.
 */

// Map action types to UI config
const actionConfig = {
  role_change: {
    label: 'Role Change',
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  user_delete: {
    label: 'User Deleted',
    icon: UserMinus,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
};

const defaultAction = {
  label: 'Unknown',
  icon: ScrollText,
  color: 'text-gray-400',
  bg: 'bg-gray-500/10',
  border: 'border-gray-500/20',
};

function ActionBadge({ action }) {
  const config = actionConfig[action] || defaultAction;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color} ${config.border}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Renders the "details" column for each log entry based on action type
 */
function LogDetails({ log }) {
  if (log.action === 'role_change') {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-gray-500">Role:</span>
        <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{log.old_value}</span>
        <span className="text-gray-600">→</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{log.new_value}</span>
      </div>
    );
  }

  if (log.action === 'user_delete') {
    return (
      <span className="text-xs text-gray-500">
        Deleted: <span className="text-red-400">{log.old_value}</span>
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-500">
      {log.old_value && `${log.old_value}`}
      {log.old_value && log.new_value && ' → '}
      {log.new_value && `${log.new_value}`}
    </span>
  );
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminAuditLogs', { page }],
    queryFn: () => fetchAuditLogs({ page, limit }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.data?.logs || [];
  const pagination = data?.data?.pagination || {};

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-gray-500 text-sm mt-1">
          Track all admin actions for accountability and forensics
        </p>
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load audit logs. Please try again.</p>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Target User</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {isLoading ? (
              // Skeleton rows
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"><div className="h-5 w-28 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-6 w-24 bg-gray-800 rounded-full animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-20 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-20 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-32 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-24 bg-gray-800 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-5 py-16 text-center text-gray-500">
                  <ScrollText size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No audit logs yet</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Admin actions like role changes and user deletions will appear here
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                  {/* Date & Time */}
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-xs text-gray-300">{formatDate(log.created_at)}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{formatTime(log.created_at)}</p>
                    </div>
                  </td>

                  {/* Action Badge */}
                  <td className="px-5 py-4">
                    <ActionBadge action={log.action} />
                  </td>

                  {/* Admin who performed */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-300">{log.admin_username || '—'}</span>
                  </td>

                  {/* Target user */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-400">{log.target_username || <span className="italic text-gray-600">deleted</span>}</span>
                  </td>

                  {/* Details */}
                  <td className="px-5 py-4">
                    <LogDetails log={log} />
                  </td>

                  {/* IP Address — partial masking for security */}
                  <td className="px-5 py-4 text-right">
                    <span className="text-xs text-gray-600 font-mono">{log.ip_address || '—'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-gray-600">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
