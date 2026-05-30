import { useQuery } from '@tanstack/react-query';
import { fetchStats } from './services/adminApi';
import { Users, FolderKanban, Briefcase, CheckSquare, UserPlus, TrendingUp, Shield } from 'lucide-react';

/**
 * Admin Dashboard Page
 * Shows platform-wide statistics with animated stat cards
 */

export default function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchStats,
    staleTime: 60 * 1000, // 1 minute
  });

  const stats = data?.data?.stats;

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.total_users ?? '—',
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      shadow: 'shadow-blue-500/20',
    },
    {
      label: 'Admins',
      value: stats?.total_admins ?? '—',
      icon: Shield,
      gradient: 'from-amber-500 to-orange-500',
      shadow: 'shadow-amber-500/20',
    },
    {
      label: 'Teams',
      value: stats?.total_teams ?? '—',
      icon: Briefcase,
      gradient: 'from-violet-500 to-purple-500',
      shadow: 'shadow-violet-500/20',
    },
    {
      label: 'Projects',
      value: stats?.total_projects ?? '—',
      icon: FolderKanban,
      gradient: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-500/20',
    },
    {
      label: 'Tasks',
      value: stats?.total_tasks ?? '—',
      icon: CheckSquare,
      gradient: 'from-rose-500 to-pink-500',
      shadow: 'shadow-rose-500/20',
    },
    {
      label: 'New (7d)',
      value: stats?.new_users_7d ?? '—',
      icon: UserPlus,
      gradient: 'from-indigo-500 to-blue-500',
      shadow: 'shadow-indigo-500/20',
    },
    {
      label: 'New (30d)',
      value: stats?.new_users_30d ?? '—',
      icon: TrendingUp,
      gradient: 'from-sky-500 to-cyan-400',
      shadow: 'shadow-sky-500/20',
    },
  ];

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview and statistics</p>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm">Failed to load statistics. Please try again.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {statCards.map(({ label, value, icon: Icon, gradient, shadow }) => (
          <div
            key={label}
            className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-3xl font-bold mt-2 text-white ${isLoading ? 'animate-pulse' : ''}`}>
                  {isLoading ? (
                    <span className="inline-block w-12 h-8 bg-gray-800 rounded" />
                  ) : (
                    value
                  )}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} ${shadow} shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
