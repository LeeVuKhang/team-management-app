import { z } from 'zod';

/**
 * Auth Validation Schemas
 * Validates authentication request data using Zod
 * Security: Prevents injection attacks and malformed data
 */

/**
 * Register (Signup) Schema
 * Validates user registration data
 */
export const registerSchema = {
  body: z.object({
    username: z
      .string()
      .min(2, 'Username must be at least 2 characters')
      .max(50, 'Username must not exceed 50 characters')
      .trim(),
    
    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email must not exceed 255 characters')
      .toLowerCase()
      .trim(),
    
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must not exceed 100 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
};

/**
 * Login Schema
 * Validates user login credentials
 */
export const loginSchema = {
  body: z.object({
    email: z
      .string()
      .email('Invalid email format')
      .toLowerCase()
      .trim(),
    
    password: z
      .string()
      .min(1, 'Password is required'),
  }),
};
