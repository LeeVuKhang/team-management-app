import { z } from 'zod';

/**
 * Admin Validation Schemas (Zod)
 * Strict input validation for all admin API endpoints
 * Security: Prevents injection attacks and enforces business rules at the input boundary
 */

/**
 * GET /admin/users — List all users
 * Pagination limits capped to prevent DoS via large page sizes
 */
export const listUsersSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),  // Cap at 100 to prevent memory abuse
    search: z.string().max(100).optional(),  // Limit search string length
    role: z.enum(['user', 'admin', 'manager']).optional(),
  }),
};

/**
 * GET /admin/users/:userId — Get single user
 */
export const getUserByIdSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
};

/**
 * PATCH /admin/users/:userId/role — Update user role
 * Validates both the target user ID and the new role value
 */
export const updateUserRoleSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    role: z.enum(['user', 'admin', 'manager']),
  }),
};

/**
 * DELETE /admin/users/:userId — Delete user
 */
export const deleteUserSchema = {
  params: z.object({
    userId: z.coerce.number().int().positive(),
  }),
};

/**
 * GET /admin/audit-logs — List audit logs
 */
export const listAuditLogsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
