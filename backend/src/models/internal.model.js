import db from '../utils/db.js';

/**
 * Internal Model for n8n Integration
 * 
 * Handles database operations for:
 * - Notifications (create, store history)
 * - Bot messages (post to channels)
 * - Task queries (deadline monitoring)
 * - Project health data (for AI analysis)
 * 
 * SECURITY: These functions are only called by internal API endpoints
 * which are protected by system key authentication.
 */

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

/**
 * Create a notification record and return it
 * @param {Object} notification - Notification data
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type = 'info',
  source = 'n8n',
  resourceType = null,
  resourceId = null,
  metadata = {},
}) => {
  const [notification] = await db`
    INSERT INTO notifications (
      user_id, title, message, type, source,
      resource_type, resource_id, metadata
    ) VALUES (
      ${userId}, ${title}, ${message}, ${type}, ${source},
      ${resourceType}, ${resourceId}, ${JSON.stringify(metadata)}
    )
    RETURNING *
  `;
  return notification;
};

/**
 * Create multiple notifications in a batch
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Array>} Created notifications
 */
export const createNotificationBatch = async (notifications) => {
  // Use a transaction for batch insert
  const results = await db.begin(async (sql) => {
    const created = [];
    for (const notif of notifications) {
      const [result] = await sql`
        INSERT INTO notifications (
          user_id, title, message, type, source,
          resource_type, resource_id, metadata
        ) VALUES (
          ${notif.userId}, ${notif.title}, ${notif.message}, 
          ${notif.type || 'info'}, 'n8n',
          ${notif.resourceType || null}, ${notif.resourceId || null}, 
          ${JSON.stringify(notif.metadata || {})}
        )
        RETURNING *
      `;
      created.push(result);
    }
    return created;
  });
  return results;
};

/**
 * Get user's unread notification count
 * @param {number} userId 
 * @returns {Promise<number>}
 */
export const getUnreadCount = async (userId) => {
  const [result] = await db`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE user_id = ${userId} AND is_read = FALSE
  `;
  return parseInt(result.count, 10);
};

/**
 * Mark notifications as read
 * @param {number} userId 
 * @param {Array<number>} notificationIds - Optional: specific IDs to mark read
 * @returns {Promise<number>} Number of notifications marked read
 */
export const markAsRead = async (userId, notificationIds = null) => {
  if (notificationIds && notificationIds.length > 0) {
    const result = await db`
      UPDATE notifications 
      SET is_read = TRUE, read_at = NOW()
      WHERE user_id = ${userId} AND id = ANY(${notificationIds})
      RETURNING id
    `;
    return result.length;
  }
  
  // Mark all as read
  const result = await db`
    UPDATE notifications 
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = ${userId} AND is_read = FALSE
    RETURNING id
  `;
  return result.length;
};

// ============================================
// BOT USER OPERATIONS
// ============================================

/**
 * Get bot user by username
 * @param {string} username - Bot username
 * @returns {Promise<Object|null>}
 */
export const getBotUser = async (username) => {
  const [bot] = await db`
    SELECT id, username, display_name, avatar_url
    FROM bot_users 
    WHERE username = ${username} AND is_active = TRUE
  `;
  return bot || null;
};

/**
 * Create a bot message in a channel
 * @param {Object} params - Message parameters
 * @returns {Promise<Object>} Created message with bot info
 */
export const createBotMessage = async ({ channelId, content, botUsername, metadata = {} }) => {
  // Get bot user
  const bot = await getBotUser(botUsername);
  if (!bot) {
    throw new Error(`Bot user '${botUsername}' not found or inactive`);
  }

  // Verify channel exists
  const [channel] = await db`
    SELECT id, team_id, project_id, name FROM channels WHERE id = ${channelId}
  `;
  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  // Insert message with special bot marker
  // Note: We use a negative user_id convention or null + bot metadata
  // to distinguish bot messages from user messages
  const [message] = await db`
    INSERT INTO messages (channel_id, user_id, content, attachment_url)
    VALUES (
      ${channelId}, 
      NULL,
      ${content}, 
      ${JSON.stringify({ isBot: true, botId: bot.id, botUsername: bot.username, ...metadata })}
    )
    RETURNING id, channel_id, content, created_at, attachment_url
  `;

  // Return message with bot info for Socket.io broadcast
  return {
    ...message,
    isBot: true,
    bot: {
      id: bot.id,
      username: bot.username,
      displayName: bot.display_name,
      avatarUrl: bot.avatar_url,
    },
    metadata,
  };
};

/**
 * Get team's general channel
 * @param {number} teamId 
 * @param {string} channelName - Default: 'general'
 * @returns {Promise<Object|null>}
 */
export const getTeamChannel = async (teamId, channelName = 'general') => {
  const [channel] = await db`
    SELECT id, team_id, name, project_id
    FROM channels 
    WHERE team_id = ${teamId} 
      AND name = ${channelName}
      AND project_id IS NULL
  `;
  return channel || null;
};

// ============================================
// TASK QUERY OPERATIONS (for n8n deadline reminders)
// ============================================

/**
 * Get tasks due within specified days, grouped by assignee
 * Used by n8n Deadline Reminder Agent
 * 
 * @param {number} daysAhead - Days to look ahead (0 = today only)
 * @param {string} excludeStatus - Status to exclude (default: 'done')
 * @returns {Promise<Array>} Tasks grouped by user
 */
export const getTasksDueSoon = async (daysAhead = 1, excludeStatus = 'done') => {
  // Calculate date range using server's timezone (Asia/Ho_Chi_Minh)
  // This ensures consistent behavior regardless of database timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead + 1); // +1 to include end of day
  
  const tasks = await db`
    SELECT 
      t.id AS task_id,
      t.title AS task_title,
      t.status,
      t.priority,
      t.due_date,
      t.project_id,
      p.name AS project_name,
      p.team_id,
      tm.name AS team_name,
      ta.user_id,
      u.username,
      u.email
    FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    INNER JOIN users u ON ta.user_id = u.id
    INNER JOIN projects p ON t.project_id = p.id
    INNER JOIN teams tm ON p.team_id = tm.id
    WHERE 
      t.due_date IS NOT NULL
      AND t.due_date >= ${today.toISOString()}
      AND t.due_date < ${endDate.toISOString()}
      AND t.status != ${excludeStatus}
    ORDER BY ta.user_id, t.due_date ASC, t.priority DESC
  `;

  // Group tasks by user for batch notifications
  const groupedByUser = tasks.reduce((acc, task) => {
    const userId = task.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        userId,
        username: task.username,
        email: task.email,
        tasks: [],
      };
    }
    acc[userId].tasks.push({
      taskId: task.task_id,
      title: task.task_title,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      projectId: task.project_id,
      projectName: task.project_name,
      teamId: task.team_id,
      teamName: task.team_name,
    });
    return acc;
  }, {});

  return Object.values(groupedByUser);
};

// ============================================
// PROJECT HEALTH OPERATIONS (for n8n Health Monitor)
// ============================================

/**
 * Get project health metrics for AI analysis
 * Used by n8n Project Health Monitor Agent
 * 
 * @param {number} projectId 
 * @returns {Promise<Object>} Project health data
 */
export const getProjectHealth = async (projectId) => {
  // Get project info
  const [project] = await db`
    SELECT 
      p.id, p.name, p.status, p.start_date, p.end_date,
      t.id AS team_id, t.name AS team_name
    FROM projects p
    INNER JOIN teams t ON p.team_id = t.id
    WHERE p.id = ${projectId}
  `;

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Get task statistics
  const taskStats = await db`
    SELECT 
      status,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status != 'done') as overdue
    FROM tasks 
    WHERE project_id = ${projectId}
    GROUP BY status
  `;

  // Get task details for overdue/high priority
  const criticalTasks = await db`
    SELECT 
      t.id, t.title, t.status, t.priority, t.due_date,
      array_agg(json_build_object('id', u.id, 'username', u.username)) as assignees
    FROM tasks t
    LEFT JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN users u ON ta.user_id = u.id
    WHERE t.project_id = ${projectId}
      AND (
        (t.due_date < CURRENT_DATE AND t.status != 'done')  -- Overdue
        OR t.priority = 'urgent'                             -- Urgent priority
        OR t.priority = 'high'                               -- High priority
      )
    GROUP BY t.id
    ORDER BY t.due_date ASC NULLS LAST
    LIMIT 10
  `;

  // Get team members count
  const [memberCount] = await db`
    SELECT COUNT(DISTINCT pm.user_id) as count
    FROM project_members pm
    WHERE pm.project_id = ${projectId}
  `;

  // Calculate metrics
  const stats = taskStats.reduce((acc, row) => {
    acc[row.status] = parseInt(row.count, 10);
    acc.overdue = (acc.overdue || 0) + parseInt(row.overdue, 10);
    return acc;
  }, { todo: 0, in_progress: 0, review: 0, done: 0, overdue: 0 });

  const totalTasks = stats.todo + stats.in_progress + stats.review + stats.done;
  const completionRate = totalTasks > 0 ? Math.round((stats.done / totalTasks) * 100) : 0;

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: project.start_date,
      endDate: project.end_date,
      teamId: project.team_id,
      teamName: project.team_name,
    },
    metrics: {
      totalTasks,
      completionRate,
      tasksByStatus: stats,
      overdueCount: stats.overdue,
      memberCount: parseInt(memberCount.count, 10),
    },
    criticalTasks,
  };
};

/**
 * Get all projects health summary for a team
 * Used by n8n Weekly Health Monitor
 * 
 * @param {number} teamId 
 * @returns {Promise<Array>} Array of project health summaries
 */
export const getTeamProjectsHealth = async (teamId) => {
  // Verify team exists
  const [team] = await db`SELECT id, name FROM teams WHERE id = ${teamId}`;
  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }

  // Get all active projects with task statistics
  const projectsHealth = await db`
    SELECT 
      p.id AS project_id,
      p.name AS project_name,
      p.status AS project_status,
      p.end_date,
      COUNT(t.id) as total_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'done') as done_tasks,
      COUNT(t.id) FILTER (WHERE t.status = 'in_progress') as in_progress_tasks,
      COUNT(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status != 'done') as overdue_tasks,
      COUNT(t.id) FILTER (WHERE t.priority IN ('urgent', 'high') AND t.status != 'done') as high_priority_pending
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.team_id = ${teamId} AND p.status = 'active'
    GROUP BY p.id
    ORDER BY overdue_tasks DESC, p.name ASC
  `;

  // Get general channel for posting reports
  const generalChannel = await getTeamChannel(teamId, 'general');

  return {
    team: {
      id: team.id,
      name: team.name,
    },
    generalChannelId: generalChannel?.id || null,
    projects: projectsHealth.map(p => ({
      projectId: p.project_id,
      projectName: p.project_name,
      status: p.project_status,
      endDate: p.end_date,
      totalTasks: parseInt(p.total_tasks, 10),
      doneTasks: parseInt(p.done_tasks, 10),
      inProgressTasks: parseInt(p.in_progress_tasks, 10),
      overdueTasks: parseInt(p.overdue_tasks, 10),
      highPriorityPending: parseInt(p.high_priority_pending, 10),
      completionRate: p.total_tasks > 0 
        ? Math.round((parseInt(p.done_tasks, 10) / parseInt(p.total_tasks, 10)) * 100) 
        : 0,
    })),
  };
};

// ============================================
// USER LOOKUP (for Socket.io targeting)
// ============================================

/**
 * Check if user exists
 * @param {number} userId 
 * @returns {Promise<Object|null>}
 */
export const getUserById = async (userId) => {
  const [user] = await db`
    SELECT id, username, email FROM users WHERE id = ${userId}
  `;
  return user || null;
};

/**
 * Get all team members (for batch operations)
 * @param {number} teamId 
 * @returns {Promise<Array>}
 */
export const getTeamMembers = async (teamId) => {
  return await db`
    SELECT 
      u.id, u.username, u.email, tm.role
    FROM team_members tm
    INNER JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ${teamId}
  `;
};
