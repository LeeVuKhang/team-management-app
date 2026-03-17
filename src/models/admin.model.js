import db from '../utils/db.js';

/**
 * Admin Model
 * Database operations for the Admin Portal
 * Security: All functions assume the caller has already been authorized via verifySystemRole
 */

/**
 * Find all users with pagination, search, and role filtering
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Results per page (max 100)
 * @param {string} [search] - Search by username or email
 * @param {string} [roleFilter] - Filter by system_role
 * @returns {Promise<{users: Object[], total: number}>}
 */
export const findAllUsers = async (page, limit, search, roleFilter) => {
  const offset = (page - 1) * limit;

  // Build WHERE conditions using postgres.js sql fragments for safe dynamic queries.
  // db.sql is the correct API for composing SQL fragments — avoids the injection risk
  // of string concatenation while being compatible with postgres.js's tagged template system.
  const conditions = [];

  if (search) {
    conditions.push(db`(username ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})`);
  }

  if (roleFilter) {
    conditions.push(db`system_role = ${roleFilter}`);
  }

  // Compose WHERE clause: empty array = no filter (WHERE TRUE), otherwise join with AND
  const whereClause = conditions.length > 0
    ? db`WHERE ${conditions.reduce((acc, cond) => db`${acc} AND ${cond}`)}`
    : db`WHERE TRUE`;

  // Parallel queries: fetch page + total count in one round-trip
  const [users, countResult] = await Promise.all([
    db`
      SELECT 
        id, username, email, avatar_url, auth_provider,
        system_role, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT COUNT(*)::int AS total
      FROM users
      ${whereClause}
    `,
  ]);

  return {
    users,
    total: countResult[0].total,
  };
};

/**
 * Find a single user by ID (detailed view for admin)
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
export const getUserById = async (userId) => {
  const [user] = await db`
    SELECT 
      id, username, email, avatar_url, auth_provider,
      system_role, created_at, updated_at
    FROM users
    WHERE id = ${userId}
  `;

  return user || null;
};

/**
 * Update a user's system role
 * Security: The caller must validate self-demotion and last-admin checks BEFORE calling this
 * @param {number} userId
 * @param {string} newRole - 'user' or 'admin'
 * @returns {Promise<Object>} Updated user
 */
export const updateUserRole = async (userId, newRole) => {
  const [user] = await db`
    UPDATE users
    SET system_role = ${newRole}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, username, email, avatar_url, system_role, updated_at
  `;

  return user;
};

/**
 * Delete a user account
 * Note: CASCADE rules in schema handle related data cleanup (team_members, messages, etc.)
 * @param {number} userId
 * @returns {Promise<Object|null>} Deleted user or null if not found
 */
export const deleteUser = async (userId) => {
  const [user] = await db`
    DELETE FROM users
    WHERE id = ${userId}
    RETURNING id, username, email
  `;

  return user || null;
};

/**
 * Count users with admin system role
 * Used by the last-admin guard to prevent total lockout
 * @returns {Promise<number>}
 */
export const getAdminCount = async () => {
  const [result] = await db`
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE system_role = 'admin'
  `;

  return result.count;
};

/**
 * Get platform-wide statistics for admin dashboard
 * Uses a single query with sub-selects for efficiency
 * @returns {Promise<Object>}
 */
export const getSystemStats = async () => {
  const [stats] = await db`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE system_role = 'admin') AS total_admins,
      (SELECT COUNT(*)::int FROM teams) AS total_teams,
      (SELECT COUNT(*)::int FROM projects) AS total_projects,
      (SELECT COUNT(*)::int FROM tasks) AS total_tasks,
      (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
      (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d
  `;

  return stats;
};

/**
 * Create an audit log entry for admin actions
 * Security: Records who performed what action, on whom, with IP for forensics
 * @param {Object} log
 * @param {number} log.adminId - Admin who performed the action
 * @param {string} log.action - Action type (e.g., 'role_change', 'user_delete')
 * @param {number} log.targetUserId - User affected by the action
 * @param {string} [log.oldValue] - Previous value
 * @param {string} [log.newValue] - New value
 * @param {string} [log.ipAddress] - Request IP address
 * @returns {Promise<Object>} Created audit log entry
 */
export const createAuditLog = async ({ adminId, action, targetUserId, oldValue, newValue, ipAddress }) => {
  const [entry] = await db`
    INSERT INTO admin_audit_logs (admin_id, action, target_user_id, old_value, new_value, ip_address)
    VALUES (${adminId}, ${action}, ${targetUserId}, ${oldValue || null}, ${newValue || null}, ${ipAddress || null})
    RETURNING id, admin_id, action, target_user_id, old_value, new_value, ip_address, created_at
  `;

  return entry;
};

/**
 * Get audit logs with pagination
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<{logs: Object[], total: number}>}
 */
export const getAuditLogs = async (page, limit) => {
  const offset = (page - 1) * limit;

  const [logs, countResult] = await Promise.all([
    db`
      SELECT 
        al.id, al.action, al.old_value, al.new_value, al.ip_address, al.created_at,
        admin_user.username AS admin_username,
        target_user.username AS target_username
      FROM admin_audit_logs al
      LEFT JOIN users admin_user ON al.admin_id = admin_user.id
      LEFT JOIN users target_user ON al.target_user_id = target_user.id
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    db`
      SELECT COUNT(*)::int AS total FROM admin_audit_logs
    `,
  ]);

  return {
    logs,
    total: countResult[0].total,
  };
};
