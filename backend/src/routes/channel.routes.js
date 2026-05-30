import express from 'express';
import * as ChannelController from '../controllers/channel.controller.js';
import { validate } from '../middlewares/validate.js';
import { verifyToken, verifyTeamMember, verifyTeamRole } from '../middlewares/auth.js';
import upload from '../middlewares/upload.js';
import {
  teamIdParamSchema,
  teamChannelParamsSchema,
  teamChannelMessageParamsSchema,
  createChannelSchema,
  createMessageSchema,
  messagesQuerySchema,
  searchMessagesQuerySchema,
} from '../validations/channel.validation.js';

/**
 * Channel Routes
 * Mounted at /teams/:teamId/channels
 * 
 * Security:
 * - All routes require JWT authentication via verifyToken
 * - All inputs validated with Zod schemas
 * - RBAC enforced via verifyTeamMember and verifyTeamRole middleware
 * - Model layer enforces team/project membership (IDOR prevention)
 */

const router = express.Router({ mergeParams: true }); // mergeParams to access :teamId

// Apply auth middleware to all channel routes
router.use(verifyToken);

/**
 * GET /teams/:teamId/channels
 * List all channels user has access to in the team
 * Access: Any team member
 */
router.get(
  '/',
  validate({ params: teamIdParamSchema }),
  verifyTeamMember,
  ChannelController.getTeamChannels
);

/**
 * POST /teams/:teamId/channels
 * Create a new channel
 * Access: Team OWNER or ADMIN only
 */
router.post(
  '/',
  validate({
    params: teamIdParamSchema,
    body: createChannelSchema,
  }),
  verifyTeamMember,
  verifyTeamRole(['owner', 'admin']),
  ChannelController.createChannel
);

/**
 * GET /teams/:teamId/channels/:channelId
 * Get a single channel by ID
 * Access: Any team member (project membership checked in model)
 */
router.get(
  '/:channelId',
  validate({ params: teamChannelParamsSchema }),
  verifyTeamMember,
  ChannelController.getChannel
);

/**
 * GET /teams/:teamId/channels/:channelId/messages/search
 * Search messages in a channel
 * Access: Any team member (project membership checked in model)
 * IMPORTANT: This route must come BEFORE /:channelId/messages to avoid route conflict
 */
router.get(
  '/:channelId/messages/search',
  validate({
    params: teamChannelParamsSchema,
    query: searchMessagesQuerySchema,
  }),
  verifyTeamMember,
  ChannelController.searchMessages
);

/**
 * GET /teams/:teamId/channels/:channelId/links
 * Get all scraped links for a channel (for Channel Info sidebar)
 * Access: Any team member (project membership checked in model)
 */
router.get(
  '/:channelId/links',
  validate({
    params: teamChannelParamsSchema,
  }),
  verifyTeamMember,
  ChannelController.getChannelLinks
);

/**
 * GET /teams/:teamId/channels/:channelId/messages
 * Get messages for a channel (with pagination)
 * Access: Any team member (project membership checked in model)
 */
router.get(
  '/:channelId/messages',
  validate({
    params: teamChannelParamsSchema,
    query: messagesQuerySchema,
  }),
  verifyTeamMember,
  ChannelController.getChannelMessages
);

/**
 * POST /teams/:teamId/channels/:channelId/messages
 * Send a message to a channel (REST fallback - prefer WebSocket)
 * Supports file attachments via multipart/form-data (up to 5 files, 100MB each)
 * Access: Any team member (project membership checked in model)
 */
router.post(
  '/:channelId/messages',
  validate({
    params: teamChannelParamsSchema,
  }),
  verifyTeamMember,
  upload.array('files', 5), // Handle up to 5 files with field name 'files'
  ChannelController.createMessage
);

/**
 * DELETE /teams/:teamId/channels/:channelId/messages/:messageId
 * Withdraw (soft-delete) a message
 * Replaces content with "This message has been withdrawn."
 * Access: Message owner only
 */
router.delete(
  '/:channelId/messages/:messageId',
  validate({ params: teamChannelMessageParamsSchema }),
  verifyTeamMember,
  ChannelController.withdrawMessage
);

/**
 * DELETE /teams/:teamId/channels/:channelId
 * Delete a channel
 * Access: Team OWNER or ADMIN only
 */
router.delete(
  '/:channelId',
  validate({ params: teamChannelParamsSchema }),
  verifyTeamMember,
  verifyTeamRole(['owner', 'admin']),
  ChannelController.deleteChannel
);

export default router;
