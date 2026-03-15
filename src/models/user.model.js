import db from '../utils/db.js';

/**
 * User Model
 * Handles database operations for user authentication and profile management
 * Security: Passwords are never returned in queries
 */

/**
 * Create a new user
 * @param {string} username - User's display name
 * @param {string} email - User's email (unique)
 * @param {string} passwordHash - Bcrypt hashed password
 * @returns {Promise<Object>} Created user object (without password)
 * @throws {Error} If email already exists
 */
export const createUser = async (username, email, passwordHash) => {
  // Insert new user
  const [user] = await db`
    INSERT INTO users (username, email, password_hash)
    VALUES (${username}, ${email}, ${passwordHash})
    RETURNING id, username, email, avatar_url, system_role, created_at
  `;

  return user;
};

/**
 * Find user by email (for login)
 * @param {string} email - User's email
 * @returns {Promise<Object|null>} User with password_hash, or null if not found
 */
export const findUserByEmail = async (email) => {
  const [user] = await db`
    SELECT id, username, email, password_hash, avatar_url, system_role, created_at
    FROM users
    WHERE email = ${email}
  `;

  return user || null;
};

/**
 * Find user by ID (for token verification)
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} User object without password
 */
export const findUserById = async (userId) => {
  const [user] = await db`
    SELECT id, username, email, avatar_url, system_role, created_at
    FROM users
    WHERE id = ${userId}
  `;

  return user || null;
};

/**
 * Check if email already exists
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if email exists
 */
export const emailExists = async (email) => {
  const [result] = await db`
    SELECT 1 FROM users WHERE email = ${email}
  `;

  return !!result;
};

/**
 * Find user by Google ID
 * @param {string} googleId - Google's unique user identifier
 * @returns {Promise<Object|null>} User object or null
 */
export const findUserByGoogleId = async (googleId) => {
  const [user] = await db`
    SELECT id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
    FROM users
    WHERE google_id = ${googleId}
  `;

  return user || null;
};

/**
 * Create a new user via Google OAuth
 * @param {Object} googleProfile - Profile data from Google
 * @returns {Promise<Object>} Created user object
 */
export const createGoogleUser = async ({ googleId, username, email, avatarUrl }) => {
  const [user] = await db`
    INSERT INTO users (google_id, username, email, avatar_url, auth_provider, password_hash)
    VALUES (${googleId}, ${username}, ${email.toLowerCase()}, ${avatarUrl}, 'google', NULL)
    RETURNING id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
  `;

  return user;
};

/**
 * Link Google account to existing user
 * @param {string} email - User's email
 * @param {string} googleId - Google's unique user identifier
 * @param {string|null} avatarUrl - Google avatar URL (optional)
 * @returns {Promise<Object>} Updated user object
 */
export const linkGoogleAccount = async (email, googleId, avatarUrl = null) => {
  const [user] = await db`
    UPDATE users 
    SET 
      google_id = ${googleId}, 
      avatar_url = COALESCE(avatar_url, ${avatarUrl}),
      auth_provider = CASE 
        WHEN password_hash IS NOT NULL THEN auth_provider 
        ELSE 'google' 
      END,
      updated_at = NOW()
    WHERE email = ${email.toLowerCase()}
    RETURNING id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
  `;

  return user;
};

/**
 * Check if user can login with password
 * (Users created via Google OAuth only cannot use password login)
 * @param {string} email - User's email
 * @returns {Promise<boolean>} True if user has a password set
 */
export const canLoginWithPassword = async (email) => {
  const [result] = await db`
    SELECT password_hash IS NOT NULL as has_password
    FROM users
    WHERE email = ${email.toLowerCase()}
  `;

  return result?.has_password || false;
};