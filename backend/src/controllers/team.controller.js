import * as TeamModel from '../models/team.model.js';

/**
 * Team Controller
 * Handles business logic and HTTP responses for team-related operations
 * Security: Relies on model's built-in RBAC and IDOR prevention
 */

/**
 * Get team details by ID
 * @route GET /api/v1/teams/:teamId
 */
export const getTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id; // From auth middleware

    const team = await TeamModel.getTeamById(teamId, userId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or you do not have access',
      });
    }

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    // Security: Do not expose internal errors to client
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error); // Pass to centralized error handler
  }
};

/**
 * Get all members of a team
 * @route GET /api/v1/teams/:teamId/members
 */
export const getTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const members = await TeamModel.getTeamMembers(teamId, userId);

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};

/**
 * Get all projects in a team
 * @route GET /api/v1/teams/:teamId/projects
 */
export const getTeamProjects = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const projects = await TeamModel.getTeamProjects(teamId, userId);

    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};

/**
 * Get team statistics (overview metrics)
 * @route GET /api/v1/teams/:teamId/stats
 */
export const getTeamStats = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const stats = await TeamModel.getTeamStats(teamId, userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};

/**
 * Get all teams for the authenticated user
 * @route GET /api/v1/teams
 */
export const getUserTeams = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const teams = await TeamModel.getUserTeams(userId);

    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new team
 * @route POST /api/v1/teams
 * SECURITY: User becomes owner automatically
 */
export const createTeam = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    const newTeam = await TeamModel.createTeam({
      name,
      description,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: newTeam,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team details
 * @route PUT /api/v1/teams/:teamId
 * SECURITY: Only owner or admin can update team
 */
export const updateTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const updatedTeam = await TeamModel.updateTeam(teamId, userId, updates);

    if (!updatedTeam) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or update failed',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: updatedTeam,
    });
  } catch (error) {
    if (error.message.includes('not authorized') || error.message.includes('Owner or Admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only team owner or admin can update team details',
      });
    }
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};

/**
 * Delete a team
 * @route DELETE /api/v1/teams/:teamId
 * SECURITY: Only owner can delete team (CASCADE will handle related data)
 */
export const deleteTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const result = await TeamModel.deleteTeam(teamId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Team not found or deletion failed',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Team deleted successfully',
    });
  } catch (error) {
    if (error.message.includes('Only the team owner')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only the team owner can delete the team',
      });
    }
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};

/**
 * Search users for team invitation
 * @route GET /api/v1/teams/:teamId/search-users?q=query
 */
export const searchUsers = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { q } = req.query;
    const userId = req.user.id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const users = await TeamModel.searchUsersForInvite(teamId, q.trim(), userId);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    next(error);
  }
};
/**
 * Get pending invitations for a team
 * @route GET /api/v1/teams/:teamId/invitations
 * SECURITY: Only owner/admin can view pending invitations
 */
export const getTeamPendingInvitations = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const invitations = await TeamModel.getTeamPendingInvitations(teamId, userId);

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    if (error.message.includes('Only team owner or admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only team owner or admin can view pending invitations',
      });
    }
    next(error);
  }
};

/**
 * Revoke a pending invitation
 * @route DELETE /api/v1/teams/:teamId/invitations/:invitationId
 * SECURITY: Only owner/admin can revoke invitations
 */
export const revokeInvitation = async (req, res, next) => {
  try {
    const { teamId, invitationId } = req.params;
    const userId = req.user.id;

    await TeamModel.revokeInvitation(teamId, invitationId, userId);

    res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    if (error.message.includes('Only team owner or admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only team owner or admin can revoke invitations',
      });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already processed',
      });
    }
    next(error);
  }
};

/**
 * Leave a team (for non-owner members)
 * @route POST /api/v1/teams/:teamId/leave
 * SECURITY: Members and admins can leave, but owners cannot (must delete team or transfer ownership)
 */
export const leaveTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    await TeamModel.leaveTeam(teamId, userId);

    res.status(200).json({
      success: true,
      message: 'You have left the team successfully',
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }
    if (error.message.includes('Owner cannot leave')) {
      return res.status(403).json({
        success: false,
        message: 'Team owners cannot leave the team. Please transfer ownership or delete the team instead.',
      });
    }
    next(error);
  }
};