import * as InvitationModel from '../models/invitation.model.js';
import { createNotification } from '../models/internal.model.js';
import db from '../utils/db.js';

/**
 * Invitation Controller
 * Handles business logic and HTTP responses for invitation-related operations
 * Security: Enforces email ownership verification for all operations
 */

/**
 * Trigger n8n webhook for onboarding notifications
 * Called when a user successfully joins a team
 * 
 * @param {Object} data - Onboarding event data
 */
const triggerOnboardingWebhook = async (data) => {
  const webhookUrl = process.env.N8N_ONBOARDING_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('N8N_ONBOARDING_WEBHOOK_URL not configured, skipping webhook');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-system-key': process.env.N8N_SECRET_KEY || '',
      },
      body: JSON.stringify({
        event: 'member.joined',
        data,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn(`n8n webhook returned ${response.status}: ${await response.text()}`);
    } else {
      console.log(`Onboarding webhook triggered for user ${data.username} in team ${data.teamName}`);
    }
  } catch (error) {
    // Don't fail the invitation accept if webhook fails
    console.error('Failed to trigger onboarding webhook:', error.message);
  }
};

/**
 * Get invitation preview (PUBLIC - no auth required)
 * Returns invitation details for display before accepting/declining
 * @route GET /api/v1/invitations/preview?token=xxx
 */
export const getInvitationPreview = async (req, res, next) => {
  try {
    const { token } = req.query;

    // Get invitation details with inviter info
    const [invitation] = await db`
      SELECT 
        ti.id,
        ti.team_id,
        ti.email,
        ti.role,
        ti.status,
        ti.expires_at,
        ti.created_at,
        t.name AS team_name,
        t.description AS team_description,
        u.id AS inviter_id,
        u.username AS inviter_name,
        u.avatar_url AS inviter_avatar,
        (SELECT COUNT(*) FROM team_members WHERE team_id = ti.team_id) AS member_count
      FROM team_invitations ti
      INNER JOIN teams t ON ti.team_id = t.id
      LEFT JOIN users u ON ti.inviter_id = u.id
      WHERE ti.token = ${token}
    `;

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or has been revoked',
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: 'This invitation has expired',
      });
    }

    // Check if already used
    if (invitation.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'This invitation has already been used',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        teamName: invitation.team_name,
        teamDescription: invitation.team_description,
        role: invitation.role,
        inviterName: invitation.inviter_name,
        inviterAvatar: invitation.inviter_avatar,
        memberCount: parseInt(invitation.member_count),
        expiresAt: invitation.expires_at,
        invitedEmail: invitation.email,
      },
    });
  } catch (error) {
    console.error('Get invitation preview error:', error);
    next(error);
  }
};

/**
 * Get all pending invitations for the current user
 * @route GET /api/v1/user/invitations
 */
export const getUserInvitations = async (req, res, next) => {
  try {
    const userEmail = req.user.email; // From auth middleware

    const invitations = await InvitationModel.getUserInvitations(userEmail);

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    console.error('Get user invitations error:', error);
    next(error);
  }
};

/**
 * Accept an invitation
 * @route POST /api/v1/invitations/accept
 * @body { token: string }
 */
export const acceptInvitation = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Validate token format (already done by middleware, but double-check)
    if (!token || token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format',
      });
    }

    const result = await InvitationModel.acceptInvitation(token, userId, userEmail);

    // Trigger n8n onboarding webhook for new members (non-blocking)
    // This allows n8n to send a welcome message to the team channel
    if (!result.alreadyMember) {
      triggerOnboardingWebhook({
        userId: req.user.id,
        username: req.user.username,
        email: userEmail,
        teamId: result.teamId,
        teamName: result.teamName,
        role: result.role || 'member',
        joinedAt: new Date().toISOString(),
      }).catch(err => console.error('Onboarding webhook error:', err));

      // Create success notification
      try {
        const notification = await createNotification({
          userId: userId,
          title: 'Welcome to the team!',
          message: `You have successfully joined ${result.teamName}`,
          type: 'success',
          source: 'system',
          resourceType: 'team',
          resourceId: result.teamId,
        });

        // Emit via Socket.io
        const io = req.app.get('io');
        if (io) {
          // 1. Notify the specific user (personal notification)
          io.to(`user:${userId}`).emit('notification', notification);

          // 2. Notify the team that a new member has joined (for real-time member list update)
          io.to(`team:${result.teamId}`).emit('member-joined', {
            teamId: result.teamId,
            member: {
              id: result.id, // This might be invitation ID from model, but we need user info
              user_id: userId,
              username: req.user.username,
              avatar_url: null, // We don't have this in req.user usually, might need to fetch or ignore for now
              role: result.role || 'member',
              email: userEmail,
              joined_at: new Date().toISOString()
            }
          });
          console.log(`Member joined event sent to team:${result.teamId}`);
        }
      } catch (notifError) {
        console.error('Failed to emit socket events:', notifError);
      }
    }

    res.status(200).json({
      success: true,
      message: result.alreadyMember
        ? `You are already a member of ${result.teamName}`
        : `Successfully joined ${result.teamName}`,
      data: {
        teamId: result.teamId,
        teamName: result.teamName,
        alreadyMember: result.alreadyMember,
      },
    });
  } catch (error) {
    console.error('Accept invitation error:', error);

    // Handle specific errors with appropriate status codes
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or has been revoked',
      });
    }

    if (error.message.includes('expired')) {
      return res.status(410).json({
        success: false,
        message: 'This invitation has expired',
      });
    }

    if (error.message.includes('already been used')) {
      return res.status(409).json({
        success: false,
        message: 'This invitation has already been used',
      });
    }

    // CRITICAL SECURITY: Email mismatch (403 Forbidden)
    if (error.message.includes('different email')) {
      return res.status(403).json({
        success: false,
        message: 'This invitation was sent to a different email address',
      });
    }

    next(error);
  }
};

/**
 * Decline an invitation
 * @route POST /api/v1/invitations/decline
 * @body { token: string }
 */
export const declineInvitation = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userEmail = req.user.email;

    if (!token || token.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format',
      });
    }

    await InvitationModel.declineInvitation(token, userEmail);

    res.status(200).json({
      success: true,
      message: 'Invitation declined successfully',
    });
  } catch (error) {
    console.error('Decline invitation error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found',
      });
    }

    if (error.message.includes('different email')) {
      return res.status(403).json({
        success: false,
        message: 'This invitation was sent to a different email address',
      });
    }

    if (error.message.includes('no longer pending')) {
      return res.status(409).json({
        success: false,
        message: 'This invitation is no longer pending',
      });
    }

    next(error);
  }
};

/**
 * Create a new invitation (Admin/Owner only)
 * @route POST /api/v1/teams/:teamId/invitations
 * @body { email: string, role: string }
 */
export const createInvitation = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { email, role } = req.body;
    const inviterId = req.user.id;

    // TODO: Verify user has admin/owner role in team before creating invitation
    // For now, we'll allow any team member to invite (will be fixed later)

    const invitation = await InvitationModel.createInvitation(
      teamId,
      inviterId,
      email,
      role || 'member'
    );

    // Get team and inviter details for notification
    const [teamInfo] = await db`
      SELECT t.name as team_name, u.username as inviter_name
      FROM teams t
      JOIN users u ON u.id = ${inviterId}
      WHERE t.id = ${teamId}
    `;

    // Check if invited user already has an account
    const [invitedUser] = await db`
      SELECT id FROM users WHERE email = ${email}
    `;

    // If user exists, emit real-time invitation event via Socket.io
    // NOTE: We don't create a notification here - invitations are managed separately
    // via getUserInvitations query. This prevents duplicate entries.
    if (invitedUser) {
      const io = req.app.get('io');
      if (io) {
        // Emit a dedicated invitation event (not a notification)
        io.to(`user:${invitedUser.id}`).emit('new-invitation', {
          id: invitation.id,
          token: invitation.token,
          team_id: parseInt(teamId),
          team_name: teamInfo.team_name,
          inviter_name: teamInfo.inviter_name,
          inviter_id: inviterId,
          role: role || 'member',
          created_at: new Date().toISOString(),
          expires_at: invitation.expiresAt,
        });
        console.log(`Invitation event sent to user ${invitedUser.id}`);
      }
    }

    // TODO: Send invitation email here
    // await sendInvitationEmail(email, invitation.token, teamName);

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitationId: invitation.id,
        expiresAt: invitation.expiresAt,
        // Don't expose token in production - only send via email
      },
    });
  } catch (error) {
    console.error('Create invitation error:', error);

    if (error.message.includes('already a member')) {
      return res.status(409).json({
        success: false,
        message: 'This user is already a member of the team',
      });
    }

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: 'An invitation for this email already exists',
      });
    }

    next(error);
  }
};
