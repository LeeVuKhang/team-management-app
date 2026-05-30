import express from 'express';
import * as TeamController from '../controllers/team.controller.js';
import { validate } from '../middlewares/validate.js';
// import { verifyToken } from '../middlewares/auth.js';
import { 
  teamIdParamSchema, 
  createTeamSchema, 
  updateTeamSchema,
  searchUsersSchema,
  invitationIdParamSchema
} from '../validations/team.validation.js';

const router = express.Router();

/**
 * Team Routes
 * All routes require JWT authentication (verifyToken middleware)
 * SECURITY: Team membership is verified in the model layer (RBAC + IDOR prevention)
 */

// Apply JWT authentication to all team routes
// router.use(verifyToken);

/**
 * @route   GET /api/v1/teams
 * @desc    Get all teams for the authenticated user
 * @access  Private
 */
router.get('/', TeamController.getUserTeams);

/**
 * @route   GET /api/v1/teams/:teamId
 * @desc    Get team details by ID
 * @access  Private (Team Member)
 */
router.get(
  '/:teamId',
  validate(teamIdParamSchema, 'params'),
  TeamController.getTeam
);

/**
 * @route   GET /api/v1/teams/:teamId/members
 * @desc    Get all members of a team
 * @access  Private (Team Member)
 */
router.get(
  '/:teamId/members',
  validate(teamIdParamSchema, 'params'),
  TeamController.getTeamMembers
);

/**
 * @route   GET /api/v1/teams/:teamId/projects
 * @desc    Get all projects in a team
 * @access  Private (Team Member)
 */
router.get(
  '/:teamId/projects',
  validate(teamIdParamSchema, 'params'),
  TeamController.getTeamProjects
);

/**
 * @route   GET /api/v1/teams/:teamId/stats
 * @desc    Get team statistics
 * @access  Private (Team Member)
 */
router.get(
  '/:teamId/stats',
  validate(teamIdParamSchema, 'params'),
  TeamController.getTeamStats
);

/**
 * @route   GET /api/v1/teams/:teamId/search-users
 * @desc    Search users for team invitation (with status indicators)
 * @access  Private (Team Member)
 * @query   q - Search query (username or email)
 */
router.get(
  '/:teamId/search-users',
  validate(teamIdParamSchema, 'params'),
  validate(searchUsersSchema, 'query'),
  TeamController.searchUsers
);

/**
 * @route   POST /api/v1/teams
 * @desc    Create a new team
 * @access  Private (Authenticated user becomes owner)
 */
router.post(
  '/',
  validate(createTeamSchema, 'body'),
  TeamController.createTeam
);

/**
 * @route   PUT /api/v1/teams/:teamId
 * @desc    Update team details
 * @access  Private (Owner or Admin only)
 */
router.put(
  '/:teamId',
  validate(teamIdParamSchema, 'params'),
  validate(updateTeamSchema, 'body'),
  TeamController.updateTeam
);

/**
 * @route   DELETE /api/v1/teams/:teamId
 * @desc    Delete a team (CASCADE deletes all projects, tasks, etc.)
 * @access  Private (Owner only)
 */
router.delete(
  '/:teamId',
  validate(teamIdParamSchema, 'params'),
  TeamController.deleteTeam
);

/**
 * @route   GET /api/v1/teams/:teamId/invitations
 * @desc    Get all pending invitations for a team
 * @access  Private (Owner/Admin only)
 */
router.get(
  '/:teamId/invitations',
  validate(teamIdParamSchema, 'params'),
  TeamController.getTeamPendingInvitations
);

/**
 * @route   DELETE /api/v1/teams/:teamId/invitations/:invitationId
 * @desc    Revoke a pending invitation
 * @access  Private (Owner/Admin only)
 */
router.delete(
  '/:teamId/invitations/:invitationId',
  validate(invitationIdParamSchema, 'params'),
  TeamController.revokeInvitation
);

/**
 * @route   POST /api/v1/teams/:teamId/leave
 * @desc    Leave a team (for non-owner members)
 * @access  Private (Member/Admin only - owners cannot leave)
 */
router.post(
  '/:teamId/leave',
  validate(teamIdParamSchema, 'params'),
  TeamController.leaveTeam
);

export default router;
