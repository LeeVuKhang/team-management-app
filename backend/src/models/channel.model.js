import db from '../utils/db.js';

/**
 * Channel Model
 * Handles database operations for channels and messages
 * Security: All queries verify team/project membership (IDOR prevention)
 */

/**
 * Verify user is a team member
 * @param {number} teamId 
 * @param {number} userId 
 * @returns {Promise<Object|null>} Membership record or null
 */
export const verifyTeamMembership = async (teamId, userId) => {
  const [membership] = await db`
    SELECT role FROM team_members 
    WHERE team_id = ${teamId} AND user_id = ${userId}
  `;
  return membership || null;
};

/**
 * Verify user is a project member (for project-specific channels)
 * @param {number} projectId 
 * @param {number} userId 
 * @returns {Promise<Object|null>} Membership record or null
 */
export const verifyProjectMembership = async (projectId, userId) => {
  const [membership] = await db`
    SELECT role FROM project_members 
    WHERE project_id = ${projectId} AND user_id = ${userId}
  `;
  return membership || null;
};

/**
 * Get all channels for a team (including project channels user has access to)
 * @param {number} teamId 
 * @param {number} userId - For RBAC verification
 * @returns {Promise<Array>} List of channels with project info
 */
export const getTeamChannels = async (teamId, userId) => {
  // SECURITY: Verify team membership first
  const membership = await verifyTeamMembership(teamId, userId);
  if (!membership) {
    throw new Error('Access denied: User is not a member of this team');
  }

  // Get all general channels (project_id IS NULL) for the team
  // Plus project-specific channels where user is a project member
  const channels = await db`
    SELECT 
      c.id,
      c.name,
      c.type,
      c.project_id,
      c.is_private,
      c.created_at,
      p.name AS project_name
    FROM channels c
    LEFT JOIN projects p ON c.project_id = p.id
    WHERE c.team_id = ${teamId}
      AND (
        c.project_id IS NULL  -- General team channels
        OR EXISTS (           -- Project channels user is member of
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = c.project_id AND pm.user_id = ${userId}
        )
      )
    ORDER BY c.project_id NULLS FIRST, c.name ASC
  `;

  return channels;
};

/**
 * Search messages in a channel
 * @param {number} channelId 
 * @param {number} userId - For access verification
 * @param {string} searchQuery - Search term
 * @returns {Promise<Array>} Matching messages
 */
export const searchMessages = async (channelId, userId, searchQuery) => {
  // SECURITY: Verify channel access first
  const channel = await getChannelById(channelId, userId);
  if (!channel) {
    throw new Error('Channel not found or access denied');
  }

  // Search messages (case-insensitive, using ILIKE for partial matches)
  // SECURITY: Parameterized query prevents SQL injection
  const messages = await db`
    SELECT 
      m.id,
      m.channel_id,
      m.user_id,
      m.content,
      m.created_at,
      u.username,
      u.email
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = ${channelId}
      AND m.content ILIKE ${`%${searchQuery}%`}
    ORDER BY m.created_at DESC
    LIMIT 50
  `;

  // Format response to match message structure
  return messages.map(msg => ({
    id: msg.id,
    channel_id: msg.channel_id,
    user_id: msg.user_id,
    content: msg.content,
    created_at: msg.created_at,
    user: {
      id: msg.user_id,
      username: msg.username,
      email: msg.email,
    },
  }));
};

/**
 * Get a single channel by ID with access verification
 * @param {number} channelId 
 * @param {number} userId 
 * @returns {Promise<Object|null>} Channel object or null
 */
export const getChannelById = async (channelId, userId) => {
  const [channel] = await db`
    SELECT 
      c.id,
      c.team_id,
      c.name,
      c.type,
      c.project_id,
      c.is_private,
      c.created_at,
      p.name AS project_name
    FROM channels c
    LEFT JOIN projects p ON c.project_id = p.id
    WHERE c.id = ${channelId}
  `;

  if (!channel) return null;

  // SECURITY: Verify user has access to this channel
  const teamMembership = await verifyTeamMembership(channel.team_id, userId);
  if (!teamMembership) {
    throw new Error('Access denied: User is not a member of this team');
  }

  // If project-specific channel, verify project membership
  if (channel.project_id) {
    const projectMembership = await verifyProjectMembership(channel.project_id, userId);
    if (!projectMembership) {
      throw new Error('Access denied: User is not a member of this project');
    }
  }

  return channel;
};

/**
 * Create a new channel
 * 
 * Security Note: Role-based access (owner/admin) is enforced at the middleware layer.
 * This function focuses on data validation and insertion.
 * 
 * @param {Object} data - Channel data {teamId, name, type, projectId, isPrivate}
 * @param {number} userId - Creator's user ID (for audit/logging purposes)
 * @returns {Promise<Object>} Created channel
 */
export const createChannel = async (data, userId) => {
  const { teamId, name, type = 'text', projectId = null, isPrivate = false } = data;

  // If project-specific, verify project exists and belongs to team
  // Security: Prevents creating channels for projects in other teams
  if (projectId) {
    const [project] = await db`
      SELECT id FROM projects WHERE id = ${projectId} AND team_id = ${teamId}
    `;
    if (!project) {
      throw new Error('Project not found or does not belong to this team');
    }
  }

  const [channel] = await db`
    INSERT INTO channels (team_id, project_id, name, type, is_private)
    VALUES (${teamId}, ${projectId}, ${name}, ${type}, ${isPrivate})
    RETURNING id, team_id, project_id, name, type, is_private, created_at
  `;

  return channel;
};

/**
 * Get messages for a channel with pagination
 * @param {number} channelId 
 * @param {number} userId - For access verification
 * @param {Object} options - {limit, before} for pagination
 * @returns {Promise<Array>} Messages with user info
 */
export const getChannelMessages = async (channelId, userId, options = {}) => {
  const { limit = 50, before = null } = options;

  // SECURITY: Verify user has access to this channel
  const channel = await getChannelById(channelId, userId);
  if (!channel) {
    throw new Error('Channel not found or access denied');
  }

  // Build query with optional cursor-based pagination
  let messages;
  if (before) {
    messages = await db`
      SELECT 
        m.id,
        m.channel_id,
        m.user_id,
        m.content,
        m.attachment_url,
        m.created_at,
        u.username,
        u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ${channelId} AND m.id < ${before}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
  } else {
    messages = await db`
      SELECT 
        m.id,
        m.channel_id,
        m.user_id,
        m.content,
        m.attachment_url,
        m.created_at,
        u.username,
        u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ${channelId}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
  }

  // Format messages for frontend (reverse to get chronological order)
  return messages.reverse().map(msg => ({
    id: msg.id,
    channel_id: msg.channel_id,
    user_id: msg.user_id,
    content: msg.content,
    attachment_url: msg.attachment_url,
    created_at: msg.created_at,
    user: {
      username: msg.username,
      avatar_url: msg.avatar_url,
    },
  }));
};

/**
 * Create a new message in a channel
 * @param {Object} data - {channelId, content, attachmentUrl}
 * @param {number} userId - Message sender
 * @returns {Promise<Object>} Created message with user info
 */
export const createMessage = async (data, userId) => {
  const { channelId, content, attachmentUrl = null } = data;

  // SECURITY: Verify user has access to this channel
  const channel = await getChannelById(channelId, userId);
  if (!channel) {
    throw new Error('Channel not found or access denied');
  }

  const [message] = await db`
    INSERT INTO messages (channel_id, user_id, content, attachment_url)
    VALUES (${channelId}, ${userId}, ${content}, ${attachmentUrl})
    RETURNING id, channel_id, user_id, content, attachment_url, created_at
  `;

  // Fetch user info for the response
  const [user] = await db`
    SELECT username, avatar_url FROM users WHERE id = ${userId}
  `;

  return {
    ...message,
    user: {
      username: user.username,
      avatar_url: user.avatar_url,
    },
  };
};

/**
 * Get user info by ID (for socket connections)
 * @param {number} userId 
 * @returns {Promise<Object|null>} User object or null
 */
export const getUserById = async (userId) => {
  const [user] = await db`
    SELECT id, username, email, avatar_url FROM users WHERE id = ${userId}
  `;
  return user || null;
};

/**
 * Delete a channel
 * @param {number} channelId 
 * @param {number} teamId - For verification
 * @param {number} userId - For RBAC verification
 * @returns {Promise<void>}
 */
export const deleteChannel = async (channelId, teamId, userId) => {
  // SECURITY: Verify team membership and role (should be owner/admin, checked by middleware)
  const membership = await verifyTeamMembership(teamId, userId);
  if (!membership) {
    throw new Error('Access denied: User is not a member of this team');
  }

  // Verify channel exists and belongs to this team
  const [channel] = await db`
    SELECT id, team_id, project_id FROM channels 
    WHERE id = ${channelId} AND team_id = ${teamId}
  `;

  if (!channel) {
    throw new Error('Channel not found');
  }

  // Delete the channel (CASCADE will delete related messages automatically via FK constraint)
  await db`
    DELETE FROM channels WHERE id = ${channelId}
  `;

  console.log(`[deleteChannel] Channel ${channelId} deleted successfully`);
};

/**
 * Withdraw (soft-delete) a message
 * Replaces message content with withdrawal notice instead of hard delete
 * @param {number} messageId - Message ID to withdraw
 * @param {number} channelId - Channel ID for verification
 * @param {number} userId - User requesting withdrawal (must be message owner)
 * @returns {Promise<Object>} Updated message
 * SECURITY: Only message owner can withdraw their own messages
 */
export const withdrawMessage = async (messageId, channelId, userId) => {
  // SECURITY: Verify message exists and user is the owner
  const [message] = await db`
    SELECT id, user_id, channel_id, content, is_withdrawn 
    FROM messages 
    WHERE id = ${messageId} AND channel_id = ${channelId}
  `;

  if (!message) {
    throw new Error('Message not found');
  }

  // SECURITY: Only the message owner can withdraw
  if (message.user_id !== userId) {
    throw new Error('Access denied: You can only withdraw your own messages');
  }

  // Check if already withdrawn
  if (message.is_withdrawn) {
    throw new Error('Message has already been withdrawn');
  }

  // Soft delete: Update content and mark as withdrawn
  const WITHDRAWN_TEXT = 'This message has been withdrawn.';

  const [updatedMessage] = await db`
    UPDATE messages 
    SET content = ${WITHDRAWN_TEXT}, 
        is_withdrawn = true, 
        attachment_url = NULL
    WHERE id = ${messageId}
    RETURNING id, channel_id, user_id, content, is_withdrawn, created_at
  `;

  // Fetch user info for the response
  const [user] = await db`
    SELECT username, avatar_url FROM users WHERE id = ${userId}
  `;

  return {
    ...updatedMessage,
    user: {
      username: user.username,
      avatar_url: user.avatar_url,
    },
  };
};
