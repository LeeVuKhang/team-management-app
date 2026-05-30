import { io } from 'socket.io-client';

/**
 * Socket Service
 * Manages Socket.io connection for real-time chat
 * 
 * Security: Uses JWT token from HTTP-only cookies for authentication
 * The token is automatically sent via withCredentials option
 */

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://new-tech-be.onrender.com';

let socket = null;

/**
 * Get JWT token from cookies (for socket auth)
 * Note: In production, the token is HTTP-only and will be sent automatically
 * This helper is mainly for development/debugging
 */
const getAuthToken = () => {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'token') {
      return value;
    }
  }
  return null;
};

/**
 * Initialize socket connection with JWT authentication
 * @returns {Socket} Socket.io client instance
 */
export const initSocket = () => {
  if (socket?.connected) {
    console.log('Socket already connected');
    return socket;
  }

  // Get token for auth (will be sent automatically via cookies)
  const token = getAuthToken();

  console.log('Initializing Socket.io connection...');
  console.log('Token found in cookies:', token ? 'Yes' : 'No');

  socket = io(SOCKET_URL, {
    withCredentials: true, // Send cookies (including JWT) for auth
    auth: {
      token, // Send token explicitly as backup
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    if (error.message.includes('Authentication') || error.message.includes('Token')) {
      console.warn('Authentication failed. Please log in again.');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

/**
 * Get the current socket instance
 * @returns {Socket|null}
 */
export const getSocket = () => socket;

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a channel room for real-time updates
 * @param {number} channelId 
 * @returns {Promise<Object>} Channel info on success
 */
export const joinChannel = (channelId) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      return reject(new Error('Socket not connected'));
    }

    socket.emit('join-channel', { channelId }, (response) => {
      if (response.success) {
        resolve(response.channel);
      } else {
        reject(new Error(response.error || 'Failed to join channel'));
      }
    });
  });
};

/**
 * Leave a channel room
 * @param {number} channelId 
 * @returns {Promise<void>}
 */
export const leaveChannel = (channelId) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      return resolve(); // Already disconnected
    }

    socket.emit('leave-channel', { channelId }, (response) => {
      if (response?.success) {
        resolve();
      } else {
        reject(new Error(response?.error || 'Failed to leave channel'));
      }
    });
  });
};

/**
 * Send a message via socket
 * @param {number} channelId 
 * @param {string} content 
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = (channelId, content) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      return reject(new Error('Socket not connected'));
    }

    socket.emit('send-message', { channelId, content }, (response) => {
      if (response.success) {
        resolve(response.message);
      } else {
        reject(new Error(response.error || 'Failed to send message'));
      }
    });
  });
};

/**
 * Emit typing start indicator
 * @param {number} channelId 
 */
export const emitTypingStart = (channelId) => {
  if (socket?.connected) {
    socket.emit('typing-start', { channelId });
  }
};

/**
 * Emit typing stop indicator
 * @param {number} channelId 
 */
export const emitTypingStop = (channelId) => {
  if (socket?.connected) {
    socket.emit('typing-stop', { channelId });
  }
};

/**
 * Subscribe to new messages in current channel
 * @param {Function} callback - Called with new message data
 * @returns {Function} Unsubscribe function
 */
export const onNewMessage = (callback) => {
  if (!socket) return () => { };

  socket.on('new-message', callback);
  return () => socket?.off('new-message', callback);
};

/**
 * Subscribe to user typing events
 * @param {Function} callback - Called with {userId, username}
 * @returns {Function} Unsubscribe function
 */
export const onUserTyping = (callback) => {
  if (!socket) return () => { };

  socket.on('user-typing', callback);
  return () => socket?.off('user-typing', callback);
};

/**
 * Subscribe to user stopped typing events
 * @param {Function} callback - Called with {userId}
 * @returns {Function} Unsubscribe function
 */
export const onUserStoppedTyping = (callback) => {
  if (!socket) return () => { };

  socket.on('user-stopped-typing', callback);
  return () => socket?.off('user-stopped-typing', callback);
};

/**
 * Subscribe to user joined events
 * @param {Function} callback - Called with {userId, username}
 * @returns {Function} Unsubscribe function
 */
export const onUserJoined = (callback) => {
  if (!socket) return () => { };

  socket.on('user-joined', callback);
  return () => socket?.off('user-joined', callback);
};

/**
 * Subscribe to user left events
 * @param {Function} callback - Called with {userId, username}
 * @returns {Function} Unsubscribe function
 */
export const onUserLeft = (callback) => {
  if (!socket) return () => { };

  socket.on('user-left', callback);
  return () => socket?.off('user-left', callback);
};

// ===== TEAM ROOM FUNCTIONS (for real-time project updates) =====

/**
 * Join a team room for real-time project updates
 * @param {number|string} teamId 
 * @returns {Promise<void>}
 */
export const joinTeam = (teamId) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      return reject(new Error('Socket not connected'));
    }

    socket.emit('join-team', { teamId }, (response) => {
      if (response?.success) {
        console.log(`Joined team room: team:${teamId}`);
        resolve();
      } else {
        reject(new Error(response?.error || 'Failed to join team room'));
      }
    });
  });
};

/**
 * Leave a team room
 * @param {number|string} teamId 
 * @returns {Promise<void>}
 */
export const leaveTeam = (teamId) => {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      return resolve();
    }

    socket.emit('leave-team', { teamId }, () => {
      console.log(`Left team room: team:${teamId}`);
      resolve();
    });
  });
};

/**
 * Subscribe to project created events in team
 */
export const onProjectCreated = (callback) => {
  if (!socket) return () => { };
  socket.on('project-created', callback);
  return () => socket?.off('project-created', callback);
};

/**
 * Subscribe to project updated events in team
 */
export const onProjectUpdated = (callback) => {
  if (!socket) return () => { };
  socket.on('project-updated', callback);
  return () => socket?.off('project-updated', callback);
};

/**
 * Subscribe to project deleted events in team
 */
export const onProjectDeleted = (callback) => {
  if (!socket) return () => { };
  socket.on('project-deleted', callback);
  return () => socket?.off('project-deleted', callback);
};

// ===== PROJECT ROOM FUNCTIONS (for real-time task updates) =====

/**
 * Join a project room for real-time task updates
 * @param {number|string} projectId 
 * @returns {Promise<void>}
 */
export const joinProject = (projectId) => {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      return reject(new Error('Socket not connected'));
    }

    socket.emit('join-project', { projectId }, (response) => {
      if (response?.success) {
        console.log(`Joined project room: project:${projectId}`);
        resolve();
      } else {
        reject(new Error(response?.error || 'Failed to join project room'));
      }
    });
  });
};

/**
 * Leave a project room
 * @param {number|string} projectId 
 * @returns {Promise<void>}
 */
export const leaveProject = (projectId) => {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      return resolve();
    }

    socket.emit('leave-project', { projectId }, () => {
      console.log(`Left project room: project:${projectId}`);
      resolve();
    });
  });
};

/**
 * Subscribe to task created events in project
 */
export const onTaskCreated = (callback) => {
  if (!socket) return () => { };
  socket.on('task-created', callback);
  return () => socket?.off('task-created', callback);
};

/**
 * Subscribe to task updated events in project
 */
export const onTaskUpdated = (callback) => {
  if (!socket) return () => { };
  socket.on('task-updated', callback);
  return () => socket?.off('task-updated', callback);
};

/**
 * Subscribe to task deleted events in project
 */
export const onTaskDeleted = (callback) => {
  if (!socket) return () => { };
  socket.on('task-deleted', callback);
  return () => socket?.off('task-deleted', callback);
};

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  joinChannel,
  leaveChannel,
  sendMessage,
  emitTypingStart,
  emitTypingStop,
  onNewMessage,
  onUserTyping,
  onUserStoppedTyping,
  onUserJoined,
  onUserLeft,
  // Team/Project real-time
  joinTeam,
  leaveTeam,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
  joinProject,
  leaveProject,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
};
