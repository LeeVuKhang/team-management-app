import { z } from 'zod';

/**
 * Channel & Message Validation Schemas
 * Using Zod for strict input validation
 * SECURITY: Prevent injection attacks, enforce constraints matching DB schema
 */

// === PARAM VALIDATORS ===

/**
 * Validate teamId parameter
 */
export const teamIdParamSchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Team ID must be greater than 0'),
});

/**
 * Validate channelId parameter
 */
export const channelIdParamSchema = z.object({
  channelId: z
    .string()
    .regex(/^\d+$/, 'Channel ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Channel ID must be greater than 0'),
});

/**
 * Validate combined teamId and channelId params
 */
export const teamChannelParamsSchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Team ID must be greater than 0'),
  channelId: z
    .string()
    .regex(/^\d+$/, 'Channel ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Channel ID must be greater than 0'),
});

/**
 * Validate combined teamId, channelId, and messageId params
 * Used for message-specific operations (withdraw, edit, etc.)
 */
export const teamChannelMessageParamsSchema = z.object({
  teamId: z
    .string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Team ID must be greater than 0'),
  channelId: z
    .string()
    .regex(/^\d+$/, 'Channel ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Channel ID must be greater than 0'),
  messageId: z
    .string()
    .regex(/^\d+$/, 'Message ID must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0, 'Message ID must be greater than 0'),
});

// === BODY VALIDATORS ===

/**
 * Validate channel creation data
 * SECURITY: Enforce DB constraints (name VARCHAR(50), type CHECK)
 */
export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1, 'Channel name is required')
    .max(50, 'Channel name must be 50 characters or less')
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Channel name can only contain lowercase letters, numbers, and hyphens')
    .refine((val) => val.length > 0, 'Channel name cannot be empty'),
  type: z
    .enum(['text', 'voice'], { errorMap: () => ({ message: 'Type must be "text" or "voice"' }) })
    .default('text'),
  projectId: z
    .number()
    .int()
    .positive('Project ID must be a positive integer')
    .nullable()
    .optional(),
  isPrivate: z
    .boolean()
    .default(false),
});

/**
 * Validate message creation data
 * SECURITY: Enforce max length, sanitize content to prevent stored XSS
 * Note: DB allows TEXT (unlimited), but we enforce 2000 char limit for UX
 */
export const createMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must be 2000 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Message cannot be empty or whitespace only'),
  attachmentUrl: z
    .string()
    .url('Attachment must be a valid URL')
    .max(500, 'Attachment URL must be 500 characters or less')
    .nullable()
    .optional(),
});

// === QUERY VALIDATORS ===

/**
 * Validate messages pagination query
 */
export const messagesQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine((val) => val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
  before: z
    .string()
    .regex(/^\d+$/, 'Before cursor must be a positive integer')
    .transform(Number)
    .optional(),
});

/**
 * Validate search query parameters
 * SECURITY: Prevent SQL injection through parameterized queries in model
 */
export const searchMessagesQuerySchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be 200 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Search query cannot be empty'),
});

// === SOCKET EVENT VALIDATORS ===

/**
 * Validate socket join-channel event
 */
export const joinChannelSchema = z.object({
  channelId: z
    .number()
    .int()
    .positive('Channel ID must be a positive integer'),
});

/**
 * Validate socket send-message event
 */
export const socketMessageSchema = z.object({
  channelId: z
    .number()
    .int()
    .positive('Channel ID must be a positive integer'),
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must be 2000 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Message cannot be empty'),
});

/**
 * Validate socket typing event
 */
export const typingSchema = z.object({
  channelId: z
    .number()
    .int()
    .positive('Channel ID must be a positive integer'),
});
