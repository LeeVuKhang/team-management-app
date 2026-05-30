import express from 'express';
import * as InvitationController from '../controllers/invitation.controller.js';
import { validate } from '../middlewares/validate.js';
import { verifyToken } from '../middlewares/auth.js';
import { invitationTokenSchema, invitationTokenQuerySchema, createInvitationSchema } from '../validations/invitation.validation.js';

const router = express.Router();

/**
 * Invitation Routes
 */

/**
 * @route   GET /api/v1/invitations/preview
 * @desc    Get invitation details for preview (PUBLIC - no auth required)
 * @access  Public
 * @query   token - Invitation token
 */
router.get(
  '/invitations/preview',
  validate(invitationTokenQuerySchema, 'query'),
  InvitationController.getInvitationPreview
);

// Apply JWT authentication to all remaining invitation routes
router.use(verifyToken);

/**
 * @route   GET /api/v1/user/invitations
 * @desc    Get all pending invitations for current user
 * @access  Private
 */
router.get('/user/invitations', InvitationController.getUserInvitations);

/**
 * @route   POST /api/v1/invitations/accept
 * @desc    Accept an invitation by token
 * @access  Private
 * @body    { token: string }
 */
router.post(
  '/invitations/accept',
  validate(invitationTokenSchema),
  InvitationController.acceptInvitation
);

/**
 * @route   POST /api/v1/invitations/decline
 * @desc    Decline an invitation by token
 * @access  Private
 * @body    { token: string }
 */
router.post(
  '/invitations/decline',
  validate(invitationTokenSchema),
  InvitationController.declineInvitation
);

/**
 * @route   POST /api/v1/teams/:teamId/invitations
 * @desc    Create a new invitation (Admin/Owner only)
 * @access  Private
 * @body    { email: string, role: string }
 */
router.post(
  '/teams/:teamId/invitations',
  validate(createInvitationSchema),
  InvitationController.createInvitation
);

export default router;
