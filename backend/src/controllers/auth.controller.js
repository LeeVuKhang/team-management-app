import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/user.model.js';

/**
 * Auth Controller
 * Handles user authentication: register, login, logout, and user info
 * Security: Passwords hashed with bcrypt, JWT tokens in HTTP-only cookies
 */

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Check if email already exists
    const emailInUse = await UserModel.emailExists(email);
    if (emailInUse) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered. Please login or use a different email.',
      });
    }

    // Hash password with bcrypt (salt rounds: 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await UserModel.createUser(username, email, passwordHash);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.system_role || 'user',  // System-level RBAC role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set token in HTTP-only cookie (prevents XSS attacks)
    res.cookie('token', token, {
      httpOnly: true, // Cannot be accessed by JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'none', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login existing user
 * @route POST /api/v1/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await UserModel.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare password with hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.system_role,  // System-level RBAC role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set token in HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user
 * @route GET /api/v1/auth/me
 * @middleware verifyToken
 */
export const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id; // From verifyToken middleware

    const user = await UserModel.findUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar_url: user.avatar_url,
          system_role: user.system_role,
          created_at: user.created_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * GOOGLE OAUTH CALLBACK
 * ==========================================
 */

/**
 * Handle Google OAuth callback
 * @route GET /api/v1/auth/google/callback
 * @desc Called after successful Google authentication
 *       Creates JWT token and redirects to frontend
 */
export const googleCallback = async (req, res, next) => {
  try {
    // User data is attached by Passport from the GoogleStrategy callback
    const user = req.user;

    if (!user) {
      console.error('❌ Google OAuth: No user data from Passport');
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/login?error=google_auth_failed`);
    }

    console.log('🔐 Google OAuth: Creating JWT for user:', user.email);

    // Generate JWT token (same as regular login)
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.system_role,  // System-level RBAC role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set token in HTTP-only cookie (same as regular login)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend success page
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    console.log('✅ Google OAuth: Redirecting to frontend...');
    
    // Redirect to dashboard (cookie is already set)
    res.redirect(`${clientUrl}/dashboard`);

  } catch (error) {
    console.error('❌ Google OAuth Callback Error:', error.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/login?error=token_generation_failed`);
  }
};

/**
 * Handle GitHub OAuth callback
 * @route GET /api/v1/auth/github/callback
 * @desc Called after successful GitHub authentication
 *       Creates JWT token and redirects to frontend
 */
export const githubCallback = async (req, res, next) => {
  try {
    // User data is attached by Passport from the GitHubStrategy callback
    const user = req.user;

    if (!user) {
      console.error('❌ GitHub OAuth: No user data from Passport');
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      return res.redirect(`${clientUrl}/login?error=github_auth_failed`);
    }

    console.log('🔐 GitHub OAuth: Creating JWT for user:', user.email);

    // Generate JWT token (same as regular login)
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.system_role,  // System-level RBAC role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set token in HTTP-only cookie (same as regular login)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend success page
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    
    console.log('✅ GitHub OAuth: Redirecting to frontend...');
    
    // Redirect to dashboard (cookie is already set)
    res.redirect(`${clientUrl}/dashboard`);

  } catch (error) {
    console.error('❌ GitHub OAuth Callback Error:', error.message);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/login?error=token_generation_failed`);
  }
};
