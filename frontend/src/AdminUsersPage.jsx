import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchUsers, updateUserRole, deleteUser } from './services/adminApi';
import { useAuth } from './hooks/useAuth';
import { Search, ChevronLeft, ChevronRight, Shield, User, Trash2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Admin Users Page
 * Full user management: search, filter, role change, delete
 */

// Role badge styling
const roleBadges = {
  admin: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  user: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

function RoleBadge({ role }) {
  const style = roleBadges[role] || roleBadges.user;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
      {role === 'admin' && <Shield size={12} className="mr-1" />}
      {role}
    </span>
  );
}

function RoleSelectDropdown({ currentRole, userId, currentUserId }) {
  const queryClient = useQueryClient();
  const isSelf = userId === currentUserId;
  const [pendingRole, setPendingRole] = useState(null); // stores the intended new role

  const mutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: (data) => {
      toast.success(data.message || 'Role updated');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setPendingRole(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update role');
      setPendingRole(null);
    },
  });

  const handleChange = (e) => {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    setPendingRole(newRole); // open the confirm modal
  };

  const handleConfirm = () => {
    mutation.mutate({ userId, role: pendingRole });
  };

  const handleCancel = () => {
    setPendingRole(null);
  };

  return (
    <>
      <select
        value={currentRole}
        onChange={handleChange}
        disabled={isSelf || mutation.isPending}
        className={`bg-gray-800 border border-gray-700 text-sm rounded-lg px-2.5 py-1.5 text-gray-300 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all ${
          isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-600'
        } ${mutation.isPending ? 'animate-pulse' : ''}`}
        title={isSelf ? 'Cannot change your own role' : 'Change system role'}
      >
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>

      {/* Role Change Confirmation Modal */}
      {pendingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Shield size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Change Role</h3>
                <p className="text-gray-500 text-xs">This will update the user's system access</p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-5">
              Change role from{' '}
              <span className="text-white font-medium">"{currentRole}"</span>
              {' '}to{' '}
              <span className="text-amber-400 font-medium">"{pendingRole}"</span>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {mutation.isPending ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DeleteUserButton({ userId, username, currentUserId }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();
  const isSelf = userId === currentUserId;

  const mutation = useMutation({
    mutationFn: () => deleteUser(userId),
    onSuccess: (data) => {
      toast.success(data.message || 'User deleted');
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setShowConfirm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    },
  });

  if (isSelf) return null;

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        title="Delete user"
      >
        <Trash2 size={16} />
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete User</h3>
                <p className="text-gray-500 text-xs">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-5">
              Are you sure you want to delete <span className="text-white font-medium">{username}</span>? 
              All their data (teams, messages, tasks) will be affected.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {mutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const limit = 20;

  // Debounce: fire search 400ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // reset to first page on new search
    }, 400);
    return () => clearTimeout(timer); // cleanup on each keystroke
  }, [searchInput]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminUsers', { page, search, role: roleFilter }],
    queryFn: () => fetchUsers({ page, limit, search, role: roleFilter }),
    placeholderData: keepPreviousData,  // v5 API: keeps previous page data visible while loading next page
  });

  const users = data?.data?.users || [];
  const pagination = data?.data?.pagination || {};

  const handleSearch = (e) => {
    e.preventDefault();
    // Allow instant search on Enter (bypass the debounce)
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setRoleFilter('');
    setPage(1);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Manage all platform users and their roles</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[240px] max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
          />
        </form>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 cursor-pointer"
        >
          <option value="">All Roles</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>

        {/* Clear Filters */}
        {(search || roleFilter) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 transition-all"
          >
            <X size={14} />
            Clear
          </button>
        )}

        {/* Count */}
        <span className="text-xs text-gray-600 ml-auto">
          {pagination.total ?? '—'} users
        </span>
      </div>

      {/* Error */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load users. Please try again.</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {isLoading ? (
              // Skeleton rows
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-4"><div className="h-8 w-48 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-16 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-7 w-20 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-24 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-7 w-8 bg-gray-800 rounded animate-pulse ml-auto" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-5 py-12 text-center text-gray-500">
                  <User size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No users found</p>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                  {/* User Info */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs font-bold">
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                          {u.username}
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">you</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Auth Provider */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-400 capitalize">{u.auth_provider}</span>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-4">
                    <RoleSelectDropdown 
                      currentRole={u.system_role} 
                      userId={u.id} 
                      currentUserId={currentUser?.id} 
                    />
                  </td>

                  {/* Joined */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'short', day: 'numeric' 
                      })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <DeleteUserButton
                      userId={u.id}
                      username={u.username}
                      currentUserId={currentUser?.id}
                    />
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
            Page {pagination.page} of {pagination.totalPages}
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
