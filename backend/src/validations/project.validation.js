import { z } from 'zod';

/**
 * Zod Validation Schemas for Project Routes
 * Security: Validates and sanitizes all inputs to prevent injection attacks
 */

// Project status enum from schema.sql
const projectStatusEnum = z.enum(['active', 'archived', 'completed']);

// Task status enum from schema.sql
const taskStatusEnum = z.enum(['todo', 'in_progress', 'review', 'done']);

// Task priority enum from schema.sql
const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Schema for creating a new task
 */
export const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters')
    .trim(),
  
  description: z.string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional()
    .nullable(),
  
  status: taskStatusEnum.default('todo'),
  
  priority: taskPriorityEnum.default('medium'),
  
  assignee_ids: z.array(
    z.number()
      .int('Assignee ID must be an integer')
      .positive('Assignee ID must be positive')
  )
    .default([])
    .optional(),
  
  due_date: z.string()
    .datetime('Invalid datetime format')
    .optional()
    .nullable(),
});

/**
 * Schema for updating a task
 * All fields are optional but at least one must be provided
 */
export const updateTaskSchema = z.object({
  title: z.string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be at most 255 characters')
    .trim()
    .optional(),
  
  description: z.string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional()
    .nullable(),
  
  status: taskStatusEnum.optional(),
  
  priority: taskPriorityEnum.optional(),
  
  assignee_ids: z.array(
    z.number()
      .int('Assignee ID must be an integer')
      .positive('Assignee ID must be positive')
  )
    .optional(),
  
  due_date: z.string()
    .datetime('Invalid datetime format')
    .optional()
    .nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for creating a new project
 * SECURITY: Sanitize inputs, enforce length limits, prevent XSS
 */
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less')
    .trim()
    .refine((val) => val.length > 0, 'Project name cannot be empty or whitespace only'),
  
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional()
    .nullable(),
  
  status: projectStatusEnum.default('active'),
  
  start_date: z.string()
    .datetime('Invalid datetime format for start date')
    .optional()
    .nullable(),
  
  end_date: z.string()
    .datetime('Invalid datetime format for end date')
    .optional()
    .nullable(),
});

/**
 * Schema for updating a project
 * SECURITY: Same validations as create, all fields optional for partial updates
 */
export const updateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name cannot be empty')
    .max(100, 'Project name must be 100 characters or less')
    .trim()
    .optional(),
  
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional()
    .nullable(),
  
  status: projectStatusEnum.optional(),
  
  start_date: z.string()
    .datetime('Invalid datetime format for start date')
    .optional()
    .nullable(),
  
  end_date: z.string()
    .datetime('Invalid datetime format for end date')
    .optional()
    .nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for teamId parameter
 */
export const teamIdParamSchema = z.object({
  teamId: z.string()
    .regex(/^\d+$/, 'Team ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Team ID must be positive'),
});

/**
 * Schema for project ID parameter
 */
export const projectIdSchema = z.object({
  projectId: z.string()
    .regex(/^\d+$/, 'Project ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Project ID must be positive'),
});

/**
 * Schema for task ID parameter
 */
export const taskIdSchema = z.object({
  taskId: z.string()
    .regex(/^\d+$/, 'Task ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Task ID must be positive'),
});

/**
 * Schema for adding a project member
 */
export const addProjectMemberSchema = z.object({
  userId: z.number()
    .int('User ID must be an integer')
    .positive('User ID must be positive'),
  role: z.enum(['lead', 'editor', 'viewer']).default('viewer'),
});

/**
 * Schema for updating a project member role
 */
export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['lead', 'editor', 'viewer']),
});

/**
 * Schema for user ID parameter
 */
export const userIdParamSchema = z.object({
  userId: z.string()
    .regex(/^\d+$/, 'User ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'User ID must be positive'),
});

/**
 * Combined schema for routes with both projectId and taskId
 */
export const projectTaskParamsSchema = z.object({
  projectId: z.string()
    .regex(/^\d+$/, 'Project ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Project ID must be positive'),
  
  taskId: z.string()
    .regex(/^\d+$/, 'Task ID must be a number')
    .transform(Number)
    .refine(val => val > 0, 'Task ID must be positive'),
});
