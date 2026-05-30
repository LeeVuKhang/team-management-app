import { z } from 'zod';

/**
 * Invitation Validation Schemas
 * Using Zod for strict input validation (SECURITY: Prevent injection attacks)
 */

/**
 * Validate invitation token in request body
 * SECURITY: Token must be exactly 64 characters (as per schema)
 */
export const invitationTokenSchema = z.object({
  token: z
    .string()
    .length(64, 'Invalid token format')
    .regex(/^[a-zA-Z0-9]+$/, 'Token must be alphanumeric'),
});

/**
 * Validate invitation token in query params (for GET preview)
 */
export const invitationTokenQuerySchema = z.object({
  token: z
    .string()
    .length(64, 'Invalid token format')
    .regex(/^[a-zA-Z0-9]+$/, 'Token must be alphanumeric'),
});

/**
 * Validate email format for invitation creation
 * SECURITY: Strict email validation, sanitization
 */
export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less'),
  role: z
    .enum(['owner', 'admin', 'member'], {
      errorMap: () => ({ message: 'Role must be owner, admin, or member' }),
    })
    .default('member'),
});
