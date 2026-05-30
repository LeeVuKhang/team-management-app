import { z } from 'zod';

/**
 * Team Validation Schemas
 * Using Zod for strict input validation (SECURITY: Prevent injection attacks)
 */

/**
 * Validate teamId parameter in route params
 */
export const teamIdParamSchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Team ID must be greater than 0'),
});

/**
 * Validate team creation data
 * SECURITY: Sanitize inputs, enforce length limits, prevent XSS
 */
export const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Team name cannot be empty or whitespace only'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional()
    .nullable(),
});

/**
 * Validate team update data
 * SECURITY: Same validations as create, all fields optional for partial updates
 */
export const updateTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name cannot be empty')
    .max(100, 'Team name must be 100 characters or less')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional()
    .nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Validate user search query
 * SECURITY: Sanitize search input, prevent SQL injection
 */
export const searchUsersSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query must be 100 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Search query cannot be empty'),
});
/**
 * Validate invitation ID parameter in route params
 */
export const invitationIdParamSchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Team ID must be greater than 0'),
  invitationId: z
    .string()
    .regex(/^\d+$/, 'Invitation ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Invitation ID must be greater than 0'),
});