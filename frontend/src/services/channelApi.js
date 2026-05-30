/**
 * Channel API Service
 * REST API calls for channels and messages
 * Note: Real-time messaging uses Socket.io, REST is fallback/initial load
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

/**
 * Fetch all channels for a team
 * @param {number} teamId 
 * @returns {Promise<Array>} Channels with project info
 */
export const fetchTeamChannels = async (teamId) => {
  const url = `${API_BASE}/teams/${teamId}/channels`;
  console.log('[channelApi] Fetching channels from:', url);

  const response = await fetch(url, {
    credentials: 'include', // Include cookies for auth
  });

  console.log('[channelApi] Response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch channels' }));
    console.error('[channelApi] Error response:', error);
    throw new Error(error.message || 'Failed to fetch channels');
  }

  const data = await response.json();
  console.log('[channelApi] Success response:', data);
  console.log('[channelApi] Extracted data.data:', data.data);
  console.log('[channelApi] Type of data.data:', typeof data.data, Array.isArray(data.data));
  return data.data || [];
};

/**
 * Fetch a single channel by ID
 * @param {number} teamId 
 * @param {number} channelId 
 * @returns {Promise<Object>} Channel details
 */
export const fetchChannel = async (teamId, channelId) => {
  const response = await fetch(`${API_BASE}/teams/${teamId}/channels/${channelId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch channel');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Create a new channel
 * @param {number} teamId 
 * @param {Object} channelData - {name, type, projectId, isPrivate}
 * @returns {Promise<Object>} Created channel
 */
export const createChannel = async (teamId, channelData) => {
  const response = await fetch(`${API_BASE}/teams/${teamId}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(channelData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create channel' }));
    throw new Error(error.message || 'Failed to create channel');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Fetch messages for a channel (initial load)
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {Object} options - {limit, before} for pagination
 * @returns {Promise<Array>} Messages with user info
 */
export const fetchChannelMessages = async (teamId, channelId, options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit);
  if (options.before) params.set('before', options.before);

  const url = `${API_BASE}/teams/${teamId}/channels/${channelId}/messages${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch messages');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Send a message via REST (fallback if socket disconnected)
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {Object} messageData - {content, attachmentUrl}
 * @returns {Promise<Object>} Created message
 */
export const sendMessageREST = async (teamId, channelId, messageData) => {
  const response = await fetch(`${API_BASE}/teams/${teamId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Send a message with file attachments via REST
 * Files are uploaded to S3 via the backend
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {string} content - Message text (can be empty if files attached)
 * @param {File[]} files - Array of files to upload
 * @returns {Promise<Object>} Created message with attachment URL
 */
export const sendMessageWithFiles = async (teamId, channelId, content, files) => {
  const formData = new FormData();

  // Append message content (can be empty string if only files)
  formData.append('content', content || '');

  // Append all files with field name 'files'
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE}/teams/${teamId}/channels/${channelId}/messages`, {
    method: 'POST',
    credentials: 'include',
    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to upload files' }));
    throw new Error(error.message || 'Failed to send message with files');
  }

  const data = await response.json();
  return data.data;
};

/**
 * Search messages in a channel
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching messages
 */
export const searchMessages = async (teamId, channelId, query) => {
  const params = new URLSearchParams({ q: query });
  const url = `${API_BASE}/teams/${teamId}/channels/${channelId}/messages/search?${params}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to search messages');
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Delete a channel
 * @param {number} teamId 
 * @param {number} channelId 
 * @returns {Promise<void>}
 */
export const deleteChannel = async (teamId, channelId) => {
  const response = await fetch(`${API_BASE}/teams/${teamId}/channels/${channelId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    // Try to parse error as JSON, fallback to text if it fails
    let errorMessage = 'Failed to delete channel';
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) {
      // If response is not JSON (e.g., HTML error page), use status text
      errorMessage = `Failed to delete channel (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMessage);
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  // If no JSON content, return success
  return { success: true };
};

/**
 * Fetch scraped links for a channel (for Channel Info sidebar)
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {Object} options - {limit, offset} for pagination
 * @returns {Promise<Array>} Links with metadata
 */
export const fetchChannelLinks = async (teamId, channelId, options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit);
  if (options.offset) params.set('offset', options.offset);

  const url = `${API_BASE}/teams/${teamId}/channels/${channelId}/links${params.toString() ? `?${params}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch links' }));
    throw new Error(error.message || 'Failed to fetch links');
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Withdraw (soft-delete) a message
 * Replaces message content with "This message has been withdrawn."
 * @param {number} teamId 
 * @param {number} channelId 
 * @param {number} messageId 
 * @returns {Promise<Object>} Updated message
 */
export const withdrawMessage = async (teamId, channelId, messageId) => {
  const response = await fetch(`${API_BASE}/teams/${teamId}/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to withdraw message' }));
    throw new Error(error.message || 'Failed to withdraw message');
  }

  const data = await response.json();
  return data;
};
