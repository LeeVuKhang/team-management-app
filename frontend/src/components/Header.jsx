import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bell, Plus, Menu, Sun, Moon, FileText, LogOut, User, HelpCircle, Check, X, Clock, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { getSocket, disconnectSocket } from '../services/socketService';
import { notificationApi, getUserInvitations, acceptInvitation, declineInvitation } from '../services/notificationApi';
import { useAuth } from '../hooks/useAuth';

// Notification type icons and colors
const NOTIFICATION_STYLES = {
  info: { icon: Info, color: 'blue' },
  warning: { icon: AlertTriangle, color: 'yellow' },
  success: { icon: CheckCircle, color: 'green' },
  error: { icon: AlertCircle, color: 'red' },
  reminder: { icon: Clock, color: 'purple' },
};

export default function Header({ isDarkMode, toggleDarkMode }) {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'invitations', 'notifications'
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notificationRef = useRef(null);
  const avatarRef = useRef(null);

  // Get current authenticated user
  const { user: currentUser, isLoading: isUserLoading } = useAuth();

  // Fetch pending invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['userInvitations'],
    queryFn: getUserInvitations,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const invitations = invitationsData?.data || [];

  // Fetch existing notifications from backend
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getNotifications({ limit: 50 }),
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Initialize notifications from fetched data
  useEffect(() => {
    if (notificationsData?.data?.notifications) {
      setNotifications(notificationsData.data.notifications);
    }
  }, [notificationsData]);

  // Listen for real-time notifications from n8n via Socket.io
  // Uses interval to retry socket connection since Layout may not have initialized it yet
  useEffect(() => {
    let socket = null;
    let checkInterval = null;
    let isCleanedUp = false;

    const handleNotification = (notification) => {
      console.log('📬 New notification:', notification);
      // Add new notification to the top, avoid duplicates
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notification.id);
        if (exists) return prev;
        return [notification, ...prev].slice(0, 50); // Keep last 50
      });
    };

    // Handler for real-time team invitations
    const handleNewInvitation = (invitation) => {
      console.log('📨 New invitation received:', invitation);
      // Invalidate the invitations query to refetch from server
      // This ensures the invitation list stays in sync
      queryClient.invalidateQueries({ queryKey: ['userInvitations'] });
    };

    const setupListener = () => {
      socket = getSocket();
      if (socket?.connected) {
        console.log('🔌 Socket connected, setting up notification & invitation listeners');
        socket.on('notification', handleNotification);
        socket.on('new-invitation', handleNewInvitation);
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        return true;
      }
      return false;
    };

    // Try immediately
    if (!setupListener() && !isCleanedUp) {
      // If not connected, retry every 500ms
      console.log('⏳ Socket not ready, waiting for connection...');
      checkInterval = setInterval(() => {
        if (isCleanedUp) {
          clearInterval(checkInterval);
          return;
        }
        setupListener();
      }, 500);
    }

    return () => {
      isCleanedUp = true;
      if (checkInterval) clearInterval(checkInterval);
      if (socket) {
        socket.off('notification', handleNotification);
        socket.off('new-invitation', handleNewInvitation);
      }
    };
  }, [queryClient]);

  // All notifications are now alerts (invitations are managed separately via getUserInvitations)
  const alertNotifications = notifications;

  // Calculate total unread count
  const unreadAlertNotifs = alertNotifications.filter(n => !n.is_read).length;
  const totalUnread = invitations.length + unreadAlertNotifs;

  // Mark notification as read (call backend API)
  const markAsRead = useCallback(async (notificationId) => {
    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
      // Call API
      await notificationApi.markAsRead({ notificationIds: [notificationId] });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Revert on error
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: false, read_at: null } : n)
      );
    }
  }, []);

  // Mark all as read (call backend API)
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length === 0) return;

      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
      // Call API (null = mark all as read)
      await notificationApi.markAsRead({ notificationIds: null });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Could revert here, but for simplicity we'll let next refetch handle it
    }
  }, [notifications]);

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: (token) => acceptInvitation(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['userInvitations']);
      setNotificationOpen(false);
      // Redirect to the team page
      navigate(`/teams/${data.data.teamId}`);
    },
  });

  // Decline invitation mutation
  const declineMutation = useMutation({
    mutationFn: (token) => declineInvitation(token),
    onSuccess: () => {
      queryClient.invalidateQueries(['userInvitations']);
    },
  });

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };

    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationOpen]);

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogout = () => {
    // Disconnect socket
    disconnectSocket();

    // Clear notifications state
    setNotifications([]);

    // Invalidate all queries
    queryClient.clear();

    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');

    // Navigate to login
    navigate('/');
  };

  const bgHeader = isDarkMode ? 'bg-dark-primary/80 border-[#1F1F1F]' : 'bg-white/80 border-gray-200';
  const inputBg = isDarkMode ? 'bg-dark-secondary border-[#171717] text-gray-100 placeholder:text-gray-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500';

  return (
    <header className={`h-16 backdrop-blur-md border-b flex items-center justify-between px-6 sticky top-0 z-10 transition-colors duration-300 ${bgHeader}`}>
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-[#171717]' : 'bg-gray-200'}`}>
            <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>T</span>
          </div>
          <span className={`text-xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Team Hub</span>
        </Link>
      </div>

      {/* Center: Search Bar */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
        <div className="relative group">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-gray-500 group-focus-within:text-gray-400' : 'text-gray-500 group-focus-within:text-gray-700'}`} size={16} />
          <input
            type="text"
            placeholder="Search..."
            className={`w-80 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'focus:ring-[#1F1F1F] focus:border-[#1F1F1F]' : 'focus:ring-gray-400 focus:border-gray-400'} ${inputBg}`}
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        <button
          onClick={toggleDarkMode}
          className={`p-2 rounded-full transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#1F1F1F]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notification Bell with Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setNotificationOpen(!isNotificationOpen)}
            className={`relative p-2 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Bell size={20} />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {isNotificationOpen && (
            <div className={`absolute right-0 mt-2 w-96 rounded-xl shadow-lg border overflow-hidden z-50 ${isDarkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
              }`}>
              {/* Header with Tabs */}
              <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-[#171717]' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Notifications
                  </h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className={`text-xs ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {/* Tabs */}
                <div className="flex gap-1">
                  {[
                    { key: 'all', label: 'All', count: totalUnread },
                    { key: 'invitations', label: 'Invitations', count: invitations.length },
                    { key: 'notifications', label: 'Alerts', count: unreadAlertNotifs },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === tab.key
                        ? isDarkMode ? 'bg-[#171717] text-white' : 'bg-gray-200 text-gray-900'
                        : isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                          }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {/* Empty State */}
                {((activeTab === 'all' && invitations.length === 0 && notifications.length === 0) ||
                  (activeTab === 'invitations' && invitations.length === 0) ||
                  (activeTab === 'notifications' && alertNotifications.length === 0)) && (
                    <div className={`p-6 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      <Bell size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No {activeTab === 'all' ? 'notifications' : activeTab}</p>
                    </div>
                  )}


                {/* Alert Notifications (from n8n) */}
                {(activeTab === 'all' || activeTab === 'notifications') && alertNotifications.map((notif) => {
                  const style = NOTIFICATION_STYLES[notif.type] || NOTIFICATION_STYLES.info;
                  const IconComponent = style.icon;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`p-4 border-b cursor-pointer transition-colors ${isDarkMode ? 'border-[#171717] hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'
                        } ${!notif.is_read ? (isDarkMode ? 'bg-blue-500/5' : 'bg-blue-50/50') : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? `bg-${style.color}-500/20` : `bg-${style.color}-100`
                          }`}>
                          <IconComponent size={16} className={`text-${style.color}-500`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {notif.title}
                            </p>
                            {!notif.is_read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>
                          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {notif.message}
                          </p>
                          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            {notif.created_at ? new Date(notif.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Team Invitations */}
                {(activeTab === 'all' || activeTab === 'invitations') && invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className={`p-4 border-b transition-colors ${isDarkMode ? 'border-[#171717] hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Inviter Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-[rgb(119,136,115)]' : 'bg-[rgb(210,220,182)]'
                        }`}>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-[rgb(60,68,58)]'
                          }`}>
                          {invite.inviter_name?.substring(0, 2).toUpperCase() || 'TM'}
                        </span>
                      </div>

                      {/* Invitation Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="font-semibold">{invite.inviter_name || 'Someone'}</span> invited you to join
                        </p>
                        <p className={`text-sm font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {invite.team_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${invite.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-blue-500/10 text-blue-500'
                            }`}>
                            {invite.role}
                          </span>
                          <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>•</span>
                          <span className={`flex items-center gap-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            <Clock size={12} />
                            {new Date(invite.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => acceptMutation.mutate(invite.token)}
                            disabled={acceptMutation.isPending || declineMutation.isPending}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDarkMode
                              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <Check size={14} />
                            {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => declineMutation.mutate(invite.token)}
                            disabled={acceptMutation.isPending || declineMutation.isPending}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDarkMode
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <X size={14} />
                            {declineMutation.isPending ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`h-8 w-[1px] mx-2 ${isDarkMode ? 'bg-[#1F1F1F]' : 'bg-gray-200'}`}></div>

        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setDropdownOpen(!isDropdownOpen)}
            className={`h-10 w-10 rounded-full border-2 flex items-center justify-center overflow-hidden transition-all hover:ring-2 ${isDarkMode ? 'bg-dark-secondary border-[#171717] hover:ring-[#1F1F1F]' : 'bg-gray-100 border-gray-300 hover:ring-gray-400 shadow-sm'}`}
          >
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.username || 'User'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <User
              size={20}
              className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}
              style={{ display: currentUser?.avatar_url ? 'none' : 'block' }}
            />
          </button>

          {isDropdownOpen && (
            <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-lg border overflow-hidden ${isDarkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'}`}>
              <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-[#171717]' : 'border-gray-200'}`}>
                {isUserLoading ? (
                  <>
                    <div className={`h-5 w-32 rounded animate-pulse mb-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                    <div className={`h-3 w-40 rounded animate-pulse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  </>
                ) : (
                  <>
                    <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {currentUser?.username || 'Unknown User'}
                    </p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {currentUser?.email || 'No email'}
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/my-tasks');
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <FileText size={16} />
                <span className="text-sm font-medium">My Tasks</span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <User size={16} />
                <span className="text-sm font-medium">Profile Settings</span>
              </button>

              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/help');
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <HelpCircle size={16} />
                <span className="text-sm font-medium">Help & Support</span>
              </button>

              <div className={`border-t ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-red-400' : 'hover:bg-gray-100 text-red-600'}`}
                >
                  <LogOut size={16} />
                  <span className="text-sm font-medium">Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
