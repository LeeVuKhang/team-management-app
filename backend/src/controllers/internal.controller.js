import * as InternalModel from '../models/internal.model.js';

/**
 * Internal API Controller for n8n Integration
 * 
 * Handles n8n webhook requests for:
 * - User notifications (real-time + stored)
 * - Bot messages to channels
 * - Task deadline queries
 * - Project health data
 * 
 * SECURITY: All endpoints are protected by system key authentication.
 * These are NOT user-facing endpoints.
 */

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

/**
 * Send notification to a single user
 * POST /api/internal/notify-user
 * 
 * Flow: n8n → This endpoint → Socket.io → Client + DB storage
 */
export const notifyUser = async (req, res, next) => {
  try {
    const { userId, title, message, type, resourceType, resourceId, metadata } = req.body;

    // Verify user exists
    const user = await InternalModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User ${userId} not found`,
      });
    }

    // Store notification in database
    const notification = await InternalModel.createNotification({
      userId,
      title,
      message,
      type,
      source: 'n8n',
      resourceType,
      resourceId,
      metadata,
    });

    // Get Socket.io instance and emit to user's room
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        id: notification.id,
        title,
        message,
        type,
        resourceType,
        resourceId,
        timestamp: notification.created_at,
      });
      console.log(`Notification sent to user:${userId} via Socket.io`);
    }

    res.status(201).json({
      success: true,
      data: {
        notificationId: notification.id,
        delivered: !!io,
      },
    });
  } catch (error) {
    console.error('Internal notify-user error:', error);
    next(error);
  }
};

/**
 * Send notifications to multiple users (batch)
 * POST /api/internal/notify-batch
 * 
 * Optimized for n8n deadline reminders to many users
 */
export const notifyBatch = async (req, res, next) => {
  try {
    const { notifications } = req.body;

    // Create all notifications in database
    const created = await InternalModel.createNotificationBatch(notifications);

    // Emit to each user via Socket.io
    const io = req.app.get('io');
    let deliveredCount = 0;

    if (io) {
      for (const notif of created) {
        io.to(`user:${notif.user_id}`).emit('notification', {
          id: notif.id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          resourceType: notif.resource_type,
          resourceId: notif.resource_id,
          timestamp: notif.created_at,
        });
        deliveredCount++;
      }
      console.log(`Batch notifications sent: ${deliveredCount} users`);
    }

    res.status(201).json({
      success: true,
      data: {
        totalCreated: created.length,
        delivered: deliveredCount,
      },
    });
  } catch (error) {
    console.error('Internal notify-batch error:', error);
    next(error);
  }
};

// ============================================
// BOT MESSAGE ENDPOINTS
// ============================================

/**
 * Post a bot message to a specific channel
 * POST /api/internal/bot-message
 * 
 * Flow: n8n → This endpoint → DB insert → Socket.io broadcast
 */
export const postBotMessage = async (req, res, next) => {
  try {
    const { channelId, content, botUsername, metadata } = req.body;

    // Create bot message in database
    const message = await InternalModel.createBotMessage({
      channelId,
      content,
      botUsername,
      metadata,
    });

    // Broadcast to channel via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('new-message', message);
      console.log(`Bot message posted to channel:${channelId} by ${botUsername}`);
    }

    res.status(201).json({
      success: true,
      data: {
        messageId: message.id,
        channelId,
        delivered: !!io,
      },
    });
  } catch (error) {
    console.error('Internal bot-message error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    next(error);
  }
};

/**
 * Post a bot message to a team's channel (by name)
 * POST /api/internal/team-announcement
 * 
 * Convenience endpoint for n8n to post to #general without knowing channel ID
 */
export const postTeamAnnouncement = async (req, res, next) => {
  try {
    const { teamId, content, botUsername, channelName, metadata } = req.body;

    // Find the team's channel
    const channel = await InternalModel.getTeamChannel(teamId, channelName);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: `Channel '${channelName}' not found in team ${teamId}`,
      });
    }

    // Create bot message
    const message = await InternalModel.createBotMessage({
      channelId: channel.id,
      content,
      botUsername,
      metadata,
    });

    // Broadcast via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel.id}`).emit('new-message', message);
      console.log(`Team announcement posted to ${channelName} in team:${teamId}`);
    }

    res.status(201).json({
      success: true,
      data: {
        messageId: message.id,
        channelId: channel.id,
        channelName: channel.name,
        delivered: !!io,
      },
    });
  } catch (error) {
    console.error('Internal team-announcement error:', error);
    next(error);
  }
};

// ============================================
// TASK QUERY ENDPOINTS (for n8n Deadline Reminder)
// ============================================

/**
 * Get tasks due soon, grouped by assignee
 * GET /api/internal/tasks/due-soon
 * 
 * Used by n8n scheduled workflow to query tasks for reminder notifications
 */
export const getTasksDueSoon = async (req, res, next) => {
  try {
    const { daysAhead, excludeStatus } = req.query;

    const tasksGrouped = await InternalModel.getTasksDueSoon(
      parseInt(daysAhead, 10) || 1,
      excludeStatus || 'done'
    );

    // Calculate summary for n8n decision logic
    const summary = {
      totalUsers: tasksGrouped.length,
      totalTasks: tasksGrouped.reduce((sum, u) => sum + u.tasks.length, 0),
    };

    res.status(200).json({
      success: true,
      data: {
        summary,
        users: tasksGrouped,
      },
    });
  } catch (error) {
    console.error('Internal tasks/due-soon error:', error);
    
    // Return more specific error for debugging
    if (error.code === 'CONNECT_TIMEOUT' || error.message?.includes('CONNECT_TIMEOUT')) {
      return res.status(503).json({
        success: false,
        error: 'Database connection timeout. Supabase may be slow or unreachable.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
    
    next(error);
  }
};

// ============================================
// PROJECT HEALTH ENDPOINTS (for n8n Health Monitor)
// ============================================

/**
 * Get project health metrics for AI analysis
 * GET /api/internal/projects/:projectId/health
 */
export const getProjectHealth = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const health = await InternalModel.getProjectHealth(parseInt(projectId, 10));

    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Internal project health error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    next(error);
  }
};

/**
 * Get all projects health summary for a team
 * GET /api/internal/teams/:teamId/health
 * 
 * Used by n8n weekly health monitor for generating team report
 */
export const getTeamHealth = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const health = await InternalModel.getTeamProjectsHealth(parseInt(teamId, 10));

    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Internal team health error:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    
    next(error);
  }
};

// ============================================
// UTILITY ENDPOINTS
// ============================================

/**
 * Get all teams (for n8n to iterate over)
 * GET /api/internal/teams
 */
export const getAllTeams = async (req, res, next) => {
  try {
    const teams = await InternalModel.getTeamMembers; // We need a new function for this
    // For now, let's create a simple query
    const { default: db } = await import('../utils/db.js');
    const teamsData = await db`
      SELECT id, name, created_at 
      FROM teams 
      ORDER BY name ASC
    `;

    res.status(200).json({
      success: true,
      data: teamsData,
    });
  } catch (error) {
    console.error('Internal get-teams error:', error);
    next(error);
  }
};

/**
 * Health check for n8n to verify API is working
 * GET /api/internal/health
 */
export const healthCheck = async (req, res) => {
  res.status(200).json({
    success: true,
    service: 'internal-api',
    timestamp: new Date().toISOString(),
    socketReady: !!req.app.get('io'),
  });
};
