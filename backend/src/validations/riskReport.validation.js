import { z } from 'zod';

/**
 * Zod Validation Schemas for Risk Report Routes
 */

export const projectIdParamSchema = z.object({
  projectId: z.string()
    .regex(/^\d+$/, 'Project ID must be a positive integer')
    .transform(val => parseInt(val, 10)),
});

export const teamIdParamSchema = z.object({
  teamId: z.string()
    .regex(/^\d+$/, 'Team ID must be a positive integer')
    .transform(val => parseInt(val, 10)),
});

export const reportIdParamSchema = z.object({
  projectId: z.string()
    .regex(/^\d+$/, 'Project ID must be a positive integer')
    .transform(val => parseInt(val, 10)),
  reportId: z.string()
    .regex(/^\d+$/, 'Report ID must be a positive integer')
    .transform(val => parseInt(val, 10)),
});

export const historyQuerySchema = z.object({
  limit: z.string()
    .regex(/^\d+$/)
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 50, 'Limit must be 1-50')
    .optional()
    .default('10'),
});

export const trendQuerySchema = z.object({
  days: z.string()
    .regex(/^\d+$/)
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 90, 'Days must be 1-90')
    .optional()
    .default('30'),
});

export default {
  projectIdParamSchema,
  teamIdParamSchema,
  reportIdParamSchema,
  historyQuerySchema,
  trendQuerySchema,
};
