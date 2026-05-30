import express from 'express';
import * as InternalController from '../controllers/internal.controller.js';
import { verifySystemKey, internalRateLimiter } from '../middlewares/internal.js';
import { validate } from '../middlewares/validate.js';
import {
  notifyUserSchema,
  notifyBatchSchema,
  botMessageSchema,
  teamAnnouncementSchema,
  tasksDueSoonSchema,
  projectHealthSchema,
  teamHealthSchema,
} from '../validations/internal.validation.js';

/**
 * Internal API Routes for n8n Integration
 * 
 * SECURITY: All routes are protected by:
 * 1. verifySystemKey - API key authentication (x-system-key header)
 * 2. internalRateLimiter - Rate limiting to prevent abuse
 * 3. Zod validation - Input validation
 * 
 * These endpoints are NOT for end users - they're for server-to-server
 * communication with n8n automation workflows.
 * 
 * Base path: /api/internal
 */

const router = express.Router();

// Apply system key authentication and rate limiting to ALL internal routes
router.use(verifySystemKey);
router.use(internalRateLimiter);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * @route   GET /api/internal/health
 * @desc    Verify internal API is operational
 * @access  Internal (System Key)
 */
router.get('/health', InternalController.healthCheck);

// ============================================
// NOTIFICATION ROUTES
// ============================================

/**
 * @route   POST /api/internal/notify-user
 * @desc    Send notification to a single user (real-time + stored)
 * @access  Internal (System Key)
 * @body    { userId, title, message, type?, resourceType?, resourceId?, metadata? }
 */
router.post(
  '/notify-user',
  validate(notifyUserSchema),
  InternalController.notifyUser
);

/**
 * @route   POST /api/internal/notify-batch
 * @desc    Send notifications to multiple users (optimized batch)
 * @access  Internal (System Key)
 * @body    { notifications: [{ userId, title, message, type?, ... }] }
 */
router.post(
  '/notify-batch',
  validate(notifyBatchSchema),
  InternalController.notifyBatch
);

// ============================================
// BOT MESSAGE ROUTES
// ============================================

/**
 * @route   POST /api/internal/bot-message
 * @desc    Post a bot message to a specific channel
 * @access  Internal (System Key)
 * @body    { channelId, content, botUsername?, metadata? }
 */
router.post(
  '/bot-message',
  validate(botMessageSchema),
  InternalController.postBotMessage
);

/**
 * @route   POST /api/internal/team-announcement
 * @desc    Post a bot message to team's channel by name (e.g., #general)
 * @access  Internal (System Key)
 * @body    { teamId, content, botUsername?, channelName?, metadata? }
 */
router.post(
  '/team-announcement',
  validate(teamAnnouncementSchema),
  InternalController.postTeamAnnouncement
);

// ============================================
// TASK QUERY ROUTES (for n8n Deadline Reminder Agent)
// ============================================

/**
 * @route   GET /api/internal/tasks/due-soon
 * @desc    Get tasks due within specified days, grouped by assignee
 * @access  Internal (System Key)
 * @query   { daysAhead?: number (default: 1), excludeStatus?: string (default: 'done') }
 * 
 * Use case: n8n scheduled workflow queries this daily at 8 AM,
 * then iterates over users to send deadline reminders.
 */
router.get(
  '/tasks/due-soon',
  validate(tasksDueSoonSchema),
  InternalController.getTasksDueSoon
);

// ============================================
// PROJECT HEALTH ROUTES (for n8n Health Monitor Agent)
// ============================================

/**
 * @route   GET /api/internal/projects/:projectId/health
 * @desc    Get project health metrics for AI analysis
 * @access  Internal (System Key)
 * 
 * Use case: n8n queries project health, sends to AI for analysis,
 * then posts summary to team channel.
 */
router.get(
  '/projects/:projectId/health',
  validate(projectHealthSchema),
  InternalController.getProjectHealth
);

/**
 * @route   GET /api/internal/teams/:teamId/health
 * @desc    Get all projects health summary for a team
 * @access  Internal (System Key)
 * 
 * Use case: n8n weekly health monitor workflow generates
 * comprehensive team report for posting to #general.
 */
router.get(
  '/teams/:teamId/health',
  validate(teamHealthSchema),
  InternalController.getTeamHealth
);

/**
 * @route   GET /api/internal/teams
 * @desc    Get all teams (for n8n to iterate over)
 * @access  Internal (System Key)
 */
router.get('/teams', InternalController.getAllTeams);

export default router;
