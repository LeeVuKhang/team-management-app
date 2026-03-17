import db from '../utils/db.js';

/**
 * User Controller
 * Handles user profile operations: get profile, update profile
 * Security: Never expose sensitive data (password_hash, raw OAuth IDs)
 */

/**
 * Get current authenticated user profile
 * @route GET /api/v1/users/me
 * @access Private (JWT required)
 */
export const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [user] = await db`
      SELECT 
        id, 
        username, 
        email, 
        avatar_url,
        auth_provider,
        google_id,
        github_id,
        system_role,
        created_at,
        updated_at
      FROM users
      WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Return user profile with computed linked account flags
    // SECURITY: Do not expose raw OAuth IDs, only boolean flags
    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        auth_provider: user.auth_provider,
        system_role: user.system_role,
        is_google_linked: !!user.google_id,
        is_github_linked: !!user.github_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('❌ Error in getMe:', error.message);
    next(error);
  }
};

/**
 * Update current authenticated user profile
 * @route PUT /api/v1/users/me
 * @access Private (JWT required)
 * @body {username?: string}
 * @file avatar (optional) - Profile picture upload
 */
export const updateMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    // Build dynamic update object
    const updates = {};

    // Handle username update
    if (username !== undefined && username.trim() !== '') {
      updates.username = username.trim();
    }

    // Handle avatar upload (from multer-s3)
    if (req.file) {
      // For S3: req.file.location contains the public URL
      // For local storage: req.file.path contains the file path
      updates.avatar_url = req.file.location || req.file.path;
      console.log('📸 Avatar uploaded:', updates.avatar_url);
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Add updated_at timestamp
    updates.updated_at = new Date();

    // Dynamic UPDATE query using postgres.js
    const [updatedUser] = await db`
      UPDATE users
      SET ${db(updates)}
      WHERE id = ${userId}
      RETURNING 
        id, 
        username, 
        email, 
        avatar_url, 
        auth_provider,
        google_id,
        github_id,
        system_role,
        created_at, 
        updated_at
    `;

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('✅ User profile updated:', updatedUser.email);

    // Return updated profile with computed flags
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        auth_provider: updatedUser.auth_provider,
        system_role: updatedUser.system_role,
        is_google_linked: !!updatedUser.google_id,
        is_github_linked: !!updatedUser.github_id,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      },
    });
  } catch (error) {
    console.error('❌ Error in updateMe:', error.message);

    // Handle unique constraint violation (if username becomes unique in future)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Username already taken',
      });
    }

    next(error);
  }
};

/**
 * Unlink OAuth provider from account
 * @route DELETE /api/v1/users/me/oauth/:provider
 * @access Private (JWT required)
 * @param provider - 'google' or 'github'
 */
export const unlinkOAuthProvider = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    // Validate provider
    if (!['google', 'github'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider. Must be "google" or "github"',
      });
    }

    // Check if user has password or another OAuth provider linked
    // (User must have at least one way to login)
    const [user] = await db`
      SELECT password_hash, google_id, github_id
      FROM users
      WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const hasPassword = !!user.password_hash;
    const hasGoogle = !!user.google_id;
    const hasGithub = !!user.github_id;

    // Count available login methods
    let loginMethodsCount = 0;
    if (hasPassword) loginMethodsCount++;
    if (hasGoogle) loginMethodsCount++;
    if (hasGithub) loginMethodsCount++;

    // Prevent unlinking if it's the only login method
    if (loginMethodsCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink. You must have at least one login method (password or OAuth provider)',
      });
    }

    // Check if the provider is actually linked
    const isProviderLinked = provider === 'google' ? hasGoogle : hasGithub;
    if (!isProviderLinked) {
      return res.status(400).json({
        success: false,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account is not linked`,
      });
    }

    // Unlink the provider
    const columnToUnlink = provider === 'google' ? 'google_id' : 'github_id';
    
    const [updatedUser] = await db`
      UPDATE users
      SET ${db({ [columnToUnlink]: null, updated_at: new Date() })}
      WHERE id = ${userId}
      RETURNING 
        id, 
        username, 
        email, 
        avatar_url, 
        auth_provider,
        google_id,
        github_id,
        system_role,
        created_at, 
        updated_at
    `;

    console.log(`✅ ${provider} account unlinked for user:`, updatedUser.email);

    res.status(200).json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully`,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        avatar_url: updatedUser.avatar_url,
        auth_provider: updatedUser.auth_provider,
        system_role: updatedUser.system_role,
        is_google_linked: !!updatedUser.google_id,
        is_github_linked: !!updatedUser.github_id,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at,
      },
    });
  } catch (error) {
    console.error('❌ Error in unlinkOAuthProvider:', error.message);
    next(error);
  }
};

export default {
  getMe,
  updateMe,
  unlinkOAuthProvider,
};