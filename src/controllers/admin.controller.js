import * as AdminModel from '../models/admin.model.js';

/**
 * Admin Controller
 * Handles admin portal operations: user management, role changes, statistics
 * Security: All routes must be protected by verifyToken + verifySystemRole(['admin'])
 */

/**
 * List all users with pagination, search, and role filter
 * @route GET /api/v1/admin/users
 */
export const listUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role } = req.validated.query;

    const { users, total } = await AdminModel.findAllUsers(page, limit, search, role);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single user by ID (detailed view)
 * @route GET /api/v1/admin/users/:userId
 */
export const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.validated.params;

    const user = await AdminModel.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a user's system role
 * @route PATCH /api/v1/admin/users/:userId/role
 * 
 * Security checks:
 * 1. Prevent self-demotion (admin can't change their own role)
 * 2. Last-admin guard (can't demote the only remaining admin)
 * 3. Audit logging (records who changed what, with IP)
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.validated.params;
    const { role: newRole } = req.body;

    // 1. SECURITY: Prevent admin from changing their own role (self-lockout protection)
    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role. Ask another admin to do this.',
      });
    }

    // 2. Check target user exists and get current role
    const targetUser = await AdminModel.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // No-op check: if role is the same, skip the update
    if (targetUser.system_role === newRole) {
      return res.status(200).json({
        success: true,
        message: 'Role is already set to this value',
        data: { user: targetUser },
      });
    }

    // 3. SECURITY: Last-admin guard — prevent demoting the last admin
    if (targetUser.system_role === 'admin' && newRole !== 'admin') {
      const adminCount = await AdminModel.getAdminCount();
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the last admin. Promote another user to admin first.',
        });
      }
    }

    // 4. Perform the role update
    const updatedUser = await AdminModel.updateUserRole(userId, newRole);

    // 5. SECURITY: Write audit log for forensics
    await AdminModel.createAuditLog({
      adminId: req.user.id,
      action: 'role_change',
      targetUserId: userId,
      oldValue: targetUser.system_role,
      newValue: newRole,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Role updated from '${targetUser.system_role}' to '${newRole}'`,
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a user account
 * @route DELETE /api/v1/admin/users/:userId
 * 
 * Security: Cannot delete yourself. CASCADE rules handle related data.
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.validated.params;

    // SECURITY: Prevent self-deletion
    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account from the admin panel.',
      });
    }

    // Check target user exists
    const targetUser = await AdminModel.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // SECURITY: Prevent deleting the last admin
    if (targetUser.system_role === 'admin') {
      const adminCount = await AdminModel.getAdminCount();
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin account.',
        });
      }
    }

    // Perform deletion (CASCADE handles related data)
    const deletedUser = await AdminModel.deleteUser(userId);

    // Audit log
    await AdminModel.createAuditLog({
      adminId: req.user.id,
      action: 'user_delete',
      targetUserId: userId,
      oldValue: `${targetUser.username} (${targetUser.email})`,
      newValue: null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `User '${deletedUser.username}' has been deleted`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get platform-wide statistics
 * @route GET /api/v1/admin/stats
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await AdminModel.getSystemStats();

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin audit logs
 * @route GET /api/v1/admin/audit-logs
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit } = req.validated.query;

    const { logs, total } = await AdminModel.getAuditLogs(page, limit);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
