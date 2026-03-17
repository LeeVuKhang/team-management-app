import express from 'express';
import * as AdminController from '../controllers/admin.controller.js';
import { verifySystemRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  listUsersSchema,
  getUserByIdSchema,
  updateUserRoleSchema,
  deleteUserSchema,
  listAuditLogsSchema,
} from '../validations/admin.validation.js';

const router = express.Router();

/**
 * Admin Routes
 * Base: /api/v1/admin
 * 
 * ALL routes require:
 * 1. verifyToken (applied at mount point in routes/index.js)
 * 2. verifySystemRole(['admin']) - live DB check, not just JWT claim
 * 
 * Security: verifySystemRole performs a DB query on EVERY request
 * to mitigate stale JWT role claims (user demoted but JWT not expired)
 */

// Apply admin system role check to ALL admin routes
router.use(verifySystemRole(['admin']));

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    List all users with pagination, search, and role filter
 * @access  Admin only
 * @query   page, limit, search, role
 */
router.get('/users', validate(listUsersSchema), AdminController.listUsers);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Get a single user's detailed profile
 * @access  Admin only
 */
router.get('/users/:userId', validate(getUserByIdSchema), AdminController.getUserById);

/**
 * @route   PATCH /api/v1/admin/users/:userId/role
 * @desc    Update a user's system role
 * @access  Admin only
 * @body    { role: 'user' | 'admin' }
 * 
 * Security guards:
 * - Cannot change own role (self-lockout prevention)
 * - Cannot demote the last admin (platform lockout prevention)
 * - All changes are audit-logged with IP address
 */
router.patch('/users/:userId/role', validate(updateUserRoleSchema), AdminController.updateUserRole);

/**
 * @route   DELETE /api/v1/admin/users/:userId
 * @desc    Delete a user account (CASCADE handles related data)
 * @access  Admin only
 * 
 * Security guards:
 * - Cannot delete own account
 * - Cannot delete the last admin
 * - Deletion is audit-logged
 */
router.delete('/users/:userId', validate(deleteUserSchema), AdminController.deleteUser);

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get platform-wide statistics (users, teams, projects, tasks)
 * @access  Admin only
 */
router.get('/stats', AdminController.getStats);

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    View audit trail of admin actions
 * @access  Admin only
 */
router.get('/audit-logs', validate(listAuditLogsSchema), AdminController.getAuditLogs);

export default router;
