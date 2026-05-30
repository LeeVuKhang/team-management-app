import express from 'express';
import * as UserController from '../controllers/user.controller.js';
import { verifyToken } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import upload from '../middlewares/upload.js';
import { z } from 'zod';

const router = express.Router();

/**
 * User Routes
 * Base: /api/v1/users
 * 
 * All routes require JWT authentication
 */

// Apply JWT authentication to all user routes
router.use(verifyToken);

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(50).optional(),
  }),
});

const unlinkProviderSchema = z.object({
  params: z.object({
    provider: z.enum(['google', 'github']),
  }),
});

// ============================================
// ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current authenticated user profile
 * @access  Private (JWT required)
 */
router.get('/me', UserController.getMe);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile (username, avatar)
 * @access  Private (JWT required)
 * @body    {username?: string}
 * @file    avatar (optional) - Profile picture, max 5MB
 */
router.put(
  '/me',
  upload.single('avatar'), // Handle single file upload with field name 'avatar'
  validate(updateProfileSchema),
  UserController.updateMe
);

/**
 * @route   DELETE /api/v1/users/me/oauth/:provider
 * @desc    Unlink OAuth provider (google/github) from account
 * @access  Private (JWT required)
 * @param   provider - 'google' or 'github'
 */
router.delete(
  '/me/oauth/:provider',
  validate(unlinkProviderSchema),
  UserController.unlinkOAuthProvider
);

export default router;