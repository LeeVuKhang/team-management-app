/**
 * Notification Service for React Client
 * 
 * Handles real-time notifications from n8n via Socket.io
 * and provides API methods for notification management.
 */

import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://new-tech-be.onrender.com';

/**
 * Notification API functions
 */
export const notificationApi = {
  /**
   * Get user's notifications (paginated)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated notifications
   */
  getNotifications: async ({ page = 1, limit = 20, unreadOnly = false }) => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(unreadOnly && { unreadOnly: 'true' }),
    });

    const response = await fetch(`${API_URL}/api/v1/notifications?${queryParams}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }

    return response.json();
  },

  /**
   * Get unread notification count
   * @returns {Promise<number>} Unread count
   */
  getUnreadCount: async () => {
    const response = await fetch(`${API_URL}/api/v1/notifications/unread-count`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch unread count');
    }

    const data = await response.json();
    return data.data.count;
  },

  /**
   * Mark notifications as read
   * @param {Array<number>} notificationIds - Optional: specific IDs to mark read
   * @returns {Promise<Object>} Result
   */
  markAsRead: async (notificationIds = null) => {
    const response = await fetch(`${API_URL}/api/v1/notifications/read`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notificationIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to mark notifications as read');
    }

    return response.json();
  },

  /**
   * Delete a notification
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} Result
   */
  deleteNotification: async (notificationId) => {
    const response = await fetch(`${API_URL}/api/v1/notifications/${notificationId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete notification');
    }

    return response.json();
  },
};

/**
 * Create a notification listener for Socket.io
 * @param {Object} socket - Socket.io client instance
 * @param {Function} onNotification - Callback for new notifications
 * @returns {Function} Cleanup function
 */
export const createNotificationListener = (socket, onNotification) => {
  if (!socket) {
    console.warn('Socket not available for notifications');
    return () => {};
  }

  const handleNotification = (notification) => {
    console.log('📬 New notification received:', notification.title);
    onNotification(notification);
  };

  socket.on('notification', handleNotification);

  // Return cleanup function
  return () => {
    socket.off('notification', handleNotification);
  };
};

/**
 * Notification types for UI styling
 */
export const NOTIFICATION_TYPES = {
  info: {
    icon: 'ℹ️',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
  },
  warning: {
    icon: '⚠️',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
  },
  success: {
    icon: '✅',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
  },
  error: {
    icon: '❌',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
  },
  reminder: {
    icon: '⏰',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
  },
};

// ==================== INVITATION API FUNCTIONS ====================

/**
 * Get all pending invitations for the current user
 * @returns {Promise<{success: boolean, data: Array}>}
 */
export async function getUserInvitations() {
  const response = await fetch(`${API_URL}/api/v1/user/invitations`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to fetch invitations');
  }

  return response.json();
}

/**
 * Get invitation preview (public - no auth required)
 * @param {string} token - Invitation token
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getInvitationPreview(token) {
  const response = await fetch(`${API_URL}/api/v1/invitations/preview?token=${encodeURIComponent(token)}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to fetch invitation preview');
  }

  return response.json();
}

/**
 * Accept a team invitation
 * @param {string} token - Invitation token
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function acceptInvitation(token) {
  const response = await fetch(`${API_URL}/api/v1/invitations/accept`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to accept invitation');
  }

  return response.json();
}

/**
 * Decline a team invitation
 * @param {string} token - Invitation token
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function declineInvitation(token) {
  const response = await fetch(`${API_URL}/api/v1/invitations/decline`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to decline invitation');
  }

  return response.json();
}

export default notificationApi;
