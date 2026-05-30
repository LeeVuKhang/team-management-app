import db from '../utils/db.js';
import crypto from 'crypto';

/**
 * Invitation Model
 * Handles database operations for team invitations
 * Security: Validates email ownership before accepting invites
 */

/**
 * Get all pending invitations for a user's email
 * @param {string} userEmail - User's email address
 * @returns {Promise<Array>} List of pending invitations with team and inviter info
 */
export const getUserInvitations = async (userEmail) => {
  const invitations = await db`
    SELECT 
      ti.id,
      ti.token,
      ti.role,
      ti.created_at,
      ti.expires_at,
      t.id AS team_id,
      t.name AS team_name,
      t.description AS team_description,
      u.id AS inviter_id,
      u.username AS inviter_name,
      u.avatar_url AS inviter_avatar
    FROM team_invitations ti
    INNER JOIN teams t ON ti.team_id = t.id
    LEFT JOIN users u ON ti.inviter_id = u.id
    WHERE ti.email = ${userEmail}
      AND ti.status = 'pending'
      AND ti.expires_at > NOW()
    ORDER BY ti.created_at DESC
  `;

  return invitations;
};

/**
 * Get invitation by token with team info
 * @param {string} token - Invitation token
 * @returns {Promise<Object|null>} Invitation details or null if not found
 */
export const getInvitationByToken = async (token) => {
  const [invitation] = await db`
    SELECT 
      ti.id,
      ti.team_id,
      ti.email,
      ti.role,
      ti.status,
      ti.expires_at,
      ti.inviter_id,
      t.name AS team_name
    FROM team_invitations ti
    INNER JOIN teams t ON ti.team_id = t.id
    WHERE ti.token = ${token}
  `;

  return invitation || null;
};

/**
 * Accept an invitation (Transaction: add to team_members + update status)
 * SECURITY: This function assumes email verification has already been done
 * @param {string} token - Invitation token
 * @param {number} userId - User ID accepting the invite
 * @param {string} userEmail - User's email (for double-check)
 * @returns {Promise<{teamId: number, teamName: string}>} Team info
 * @throws {Error} If invitation is invalid, expired, or email mismatch
 */
export const acceptInvitation = async (token, userId, userEmail) => {
  // Start transaction
  return await db.begin(async (sql) => {
    // 1. Get invitation with FOR UPDATE lock to prevent race conditions
    const [invitation] = await sql`
      SELECT 
        id,
        team_id,
        email,
        role,
        status,
        expires_at
      FROM team_invitations
      WHERE token = ${token}
      FOR UPDATE
    `;

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // 2. SECURITY: Verify status is pending
    if (invitation.status !== 'pending') {
      throw new Error('Invitation has already been used or expired');
    }

    // 3. SECURITY: Verify expiry
    if (new Date(invitation.expires_at) < new Date()) {
      // Update status to expired
      await sql`
        UPDATE team_invitations
        SET status = 'expired'
        WHERE id = ${invitation.id}
      `;
      throw new Error('Invitation has expired');
    }

    // 4. CRITICAL SECURITY: Verify email match
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error('This invitation was sent to a different email address');
    }

    // 5. Check if user is already a team member
    const [existingMember] = await sql`
      SELECT id FROM team_members
      WHERE team_id = ${invitation.team_id}
        AND user_id = ${userId}
    `;

    if (existingMember) {
      // User is already a member, just mark invitation as accepted
      await sql`
        UPDATE team_invitations
        SET status = 'accepted'
        WHERE id = ${invitation.id}
      `;
      
      // Get team name
      const [team] = await sql`
        SELECT name FROM teams WHERE id = ${invitation.team_id}
      `;
      
      return {
        teamId: invitation.team_id,
        teamName: team.name,
        alreadyMember: true,
      };
    }

    // 6. Add user to team_members
    await sql`
      INSERT INTO team_members (team_id, user_id, role)
      VALUES (${invitation.team_id}, ${userId}, ${invitation.role})
    `;

    // 7. Update invitation status to accepted
    await sql`
      UPDATE team_invitations
      SET status = 'accepted'
      WHERE id = ${invitation.id}
    `;

    // 8. Get team name for response
    const [team] = await sql`
      SELECT name FROM teams WHERE id = ${invitation.team_id}
    `;

    return {
      teamId: invitation.team_id,
      teamName: team.name,
      alreadyMember: false,
    };
  });
};

/**
 * Decline an invitation (update status or delete)
 * SECURITY: Verify email ownership before declining
 * @param {string} token - Invitation token
 * @param {string} userEmail - User's email (for verification)
 * @returns {Promise<void>}
 * @throws {Error} If invitation not found or email mismatch
 */
export const declineInvitation = async (token, userEmail) => {
  const [invitation] = await db`
    SELECT id, email, status
    FROM team_invitations
    WHERE token = ${token}
  `;

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // SECURITY: Verify email match
  if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation is no longer pending');
  }

  // Option 1: Delete the record (cleaner)
  await db`
    DELETE FROM team_invitations
    WHERE id = ${invitation.id}
  `;

  // Option 2: Update status to 'rejected' (for audit trail)
  // await db`
  //   UPDATE team_invitations
  //   SET status = 'rejected'
  //   WHERE id = ${invitation.id}
  // `;
};

/**
 * Create a new invitation (for future implementation)
 * @param {number} teamId - Team ID
 * @param {number} inviterId - User ID of inviter
 * @param {string} email - Email to invite
 * @param {string} role - Role to assign
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
export const createInvitation = async (teamId, inviterId, email, role = 'member') => {
  // Generate secure random token (64 characters)
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    // Check if user already exists in the team
    const [existingUser] = await db`
      SELECT u.id, tm.id as membership_id
      FROM users u
      LEFT JOIN team_members tm ON u.id = tm.user_id AND tm.team_id = ${teamId}
      WHERE u.email = ${email}
    `;

    if (existingUser && existingUser.membership_id) {
      throw new Error('This user is already a member of the team');
    }

    const [invitation] = await db`
      INSERT INTO team_invitations (team_id, inviter_id, email, role, token, expires_at)
      VALUES (${teamId}, ${inviterId}, ${email}, ${role}, ${token}, ${expiresAt})
      ON CONFLICT (team_id, email) 
      DO UPDATE SET 
        token = ${token},
        expires_at = ${expiresAt},
        status = 'pending',
        inviter_id = ${inviterId}
      RETURNING id, token, expires_at
    `;

    return {
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expires_at,
    };
  } catch (error) {
    // Handle duplicate email+team constraint
    if (error.message.includes('already a member')) {
      throw error;
    }
    if (error.code === '23505') { // Postgres unique violation
      throw new Error('An invitation for this email already exists in this team');
    }
    throw error;
  }
};
