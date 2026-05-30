import express from 'express';
import passport from 'passport';
import * as AuthController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { verifyToken } from '../middlewares/auth.js';
import { registerSchema, loginSchema } from '../validations/auth.validation.js';

const router = express.Router();

/**
 * Auth Routes
 * Handles user authentication endpoints
 */

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user account
 * @access Public
 */
router.post('/register', validate(registerSchema), AuthController.register);

/**
 * @route POST /api/v1/auth/login
 * @desc Login existing user
 * @access Public
 */
router.post('/login', validate(loginSchema), AuthController.login);

/**
 * @route POST /api/v1/auth/logout
 * @desc Logout current user (clear cookie)
 * @access Public
 */
router.post('/logout', AuthController.logout);

/**
 * @route GET /api/v1/auth/me
 * @desc Get current authenticated user information
 * @access Private (requires authentication)
 */
router.get('/me', verifyToken, AuthController.getMe);

/**
 * ==========================================
 * GOOGLE OAUTH ROUTES
 * ==========================================
 */

/**
 * @route GET /api/v1/auth/google
 * @desc Initiate Google OAuth login flow
 * @access Public
 */
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

/**
 * @route GET /api/v1/auth/google/callback
 * @desc Google OAuth callback - handles redirect from Google
 * @access Public (called by Google)
 */
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false, 
    failureRedirect: '/login?error=google_auth_failed' 
  }),
  AuthController.googleCallback
);

/**
 * ==========================================
 * GITHUB OAUTH ROUTES
 * ==========================================
 */

/**
 * @route GET /api/v1/auth/github
 * @desc Initiate GitHub OAuth login flow
 * @access Public
 */
router.get('/github', passport.authenticate('github', { 
  scope: ['user:email'] 
}));

/**
 * @route GET /api/v1/auth/github/callback
 * @desc GitHub OAuth callback - handles redirect from GitHub
 * @access Public (called by GitHub)
 */
router.get('/github/callback',
  passport.authenticate('github', { 
    session: false, 
    failureRedirect: '/login?error=github_auth_failed' 
  }),
  AuthController.githubCallback
);

export default router;
