import { z } from 'zod';

/**
 * Internal API Validation Schemas
 * 
 * SECURITY: Strict Zod validation for all n8n API endpoints.
 * Even though n8n is trusted, we validate to prevent bugs and ensure data integrity.
 */

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

/**
 * Schema for sending notification to a single user
 * Used by: POST /api/internal/notify-user
 */
export const notifyUserSchema = z.object({
  body: z.object({
    userId: z.number().int().positive('User ID must be a positive integer'),
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
    type: z.enum(['info', 'warning', 'success', 'error', 'reminder']).default('info'),
    // Optional: Link notification to a resource
    resourceType: z.enum(['task', 'project', 'team', 'channel']).optional(),
    resourceId: z.number().int().positive().optional(),
    // Optional: Custom metadata for tracking
    metadata: z.record(z.unknown()).optional(),
  }),
});

/**
 * Schema for batch notifications (multiple users)
 * Used by: POST /api/internal/notify-batch
 */
export const notifyBatchSchema = z.object({
  body: z.object({
    notifications: z.array(
      z.object({
        userId: z.number().int().positive(),
        title: z.string().min(1).max(255),
        message: z.string().min(1).max(2000),
        type: z.enum(['info', 'warning', 'success', 'error', 'reminder']).default('info'),
        resourceType: z.enum(['task', 'project', 'team', 'channel']).optional(),
        resourceId: z.number().int().positive().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    ).min(1, 'At least one notification required').max(100, 'Maximum 100 notifications per batch'),
  }),
});

// ============================================
// BOT MESSAGE SCHEMAS
// ============================================

/**
 * Schema for posting bot message to a channel
 * Used by: POST /api/internal/bot-message
 */
export const botMessageSchema = z.object({
  body: z.object({
    channelId: z.number().int().positive('Channel ID must be a positive integer'),
    content: z.string().min(1, 'Message content is required').max(4000, 'Message too long'),
    // Bot identifier (must match bot_users table)
    botUsername: z.enum(['system-bot', 'reminder-bot', 'onboarding-bot', 'health-bot']).default('system-bot'),
    // Optional: Embed/attachment data
    metadata: z.record(z.unknown()).optional(),
  }),
});

/**
 * Schema for posting to team's general channel
 * Used by: POST /api/internal/team-announcement
 */
export const teamAnnouncementSchema = z.object({
  body: z.object({
    teamId: z.number().int().positive('Team ID must be a positive integer'),
    content: z.string().min(1, 'Message content is required').max(4000, 'Message too long'),
    botUsername: z.enum(['system-bot', 'reminder-bot', 'onboarding-bot', 'health-bot']).default('system-bot'),
    // Channel name to post to (defaults to 'general')
    channelName: z.string().default('general'),
    metadata: z.record(z.unknown()).optional(),
  }),
});

// ============================================
// TASK QUERY SCHEMAS (for deadline reminders)
// ============================================

/**
 * Schema for querying tasks due soon
 * Used by: GET /api/internal/tasks/due-soon
 */
export const tasksDueSoonSchema = z.object({
  query: z.object({
    // Number of days to look ahead (default: 1 = today and tomorrow)
    daysAhead: z.coerce.number().int().min(0).max(30).default(1),
    // Exclude completed tasks
    excludeStatus: z.string().default('done'),
  }),
});

/**
 * Schema for getting project health data
 * Used by: GET /api/internal/projects/:projectId/health
 */
export const projectHealthSchema = z.object({
  params: z.object({
    projectId: z.coerce.number().int().positive(),
  }),
});

/**
 * Schema for getting team health overview
 * Used by: GET /api/internal/teams/:teamId/health
 */
export const teamHealthSchema = z.object({
  params: z.object({
    teamId: z.coerce.number().int().positive(),
  }),
});

// ============================================
// WEBHOOK SCHEMAS (for n8n triggers)
// ============================================

/**
 * Schema for onboarding webhook payload
 * Sent when a new member joins a team
 */
export const onboardingWebhookSchema = z.object({
  body: z.object({
    event: z.literal('member.joined'),
    data: z.object({
      userId: z.number().int().positive(),
      username: z.string(),
      email: z.string().email(),
      teamId: z.number().int().positive(),
      teamName: z.string(),
      role: z.enum(['owner', 'admin', 'member']),
      joinedAt: z.string().datetime(),
    }),
  }),
});
