import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import db from '../utils/db.js';

/**
 * Passport Configuration for OAuth 2.0 (Google & GitHub)
 * 
 * Environment Variables Required:
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 */

// Validate required environment variables for Google
const googleEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
googleEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.warn(`⚠️ Warning: ${varName} is not set in environment variables`);
  }
});

// Validate required environment variables for GitHub
const githubEnvVars = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'];
githubEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.warn(`⚠️ Warning: ${varName} is not set in environment variables`);
  }
});

/**
 * ==========================================
 * GOOGLE OAUTH 2.0 STRATEGY
 * ==========================================
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: '/api/v1/auth/google/callback',
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // ========================================
        // Extract profile information from Google
        // ========================================
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const displayName = profile.displayName || email?.split('@')[0] || 'User';
        const avatar = profile.photos?.[0]?.value || null;

        console.log('=== Google OAuth Callback ===');
        console.log('Google ID:', googleId);
        console.log('Email:', email);
        console.log('Display Name:', displayName);
        console.log('Avatar URL:', avatar);

        // Validate required fields
        if (!email) {
          console.error('❌ Google OAuth Error: No email provided');
          return done(new Error('Google account does not have an email address'), null);
        }

        // ========================================
        // Query 1: Find user by Google ID
        // ========================================
        console.log('🔍 Query 1: Searching by Google ID...');
        const [existingGoogleUser] = await db`
          SELECT id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
          FROM users
          WHERE google_id = ${googleId}
        `;

        if (existingGoogleUser) {
          console.log('✅ Found existing user by Google ID:', existingGoogleUser.email);
          return done(null, existingGoogleUser);
        }

        // ========================================
        // Query 2: Find user by Email (Link account)
        // ========================================
        console.log('🔍 Query 2: Searching by Email...');
        const [existingEmailUser] = await db`
          SELECT id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
          FROM users
          WHERE email = ${email.toLowerCase()}
        `;

        if (existingEmailUser) {
          // User exists with this email but hasn't linked Google yet
          console.log('🔗 Found existing user by Email, linking Google account...');
          
          const [updatedUser] = await db`
            UPDATE users
            SET 
              google_id = ${googleId},
              avatar_url = COALESCE(avatar_url, ${avatar}),
              auth_provider = CASE 
                WHEN auth_provider = 'local' AND password_hash IS NOT NULL 
                THEN 'local' 
                ELSE 'google' 
              END,
              updated_at = NOW()
            WHERE email = ${email.toLowerCase()}
            RETURNING id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
          `;

          console.log('✅ Successfully linked Google account to existing user:', updatedUser.email);
          return done(null, updatedUser);
        }

        // ========================================
        // Query 3: Create new user (First time Google login)
        // ========================================
        console.log('📝 Query 3: Creating new user...');
        const [newUser] = await db`
          INSERT INTO users (
            username, 
            email, 
            google_id, 
            avatar_url, 
            auth_provider, 
            password_hash
          )
          VALUES (
            ${displayName}, 
            ${email.toLowerCase()}, 
            ${googleId}, 
            ${avatar}, 
            'google', 
            NULL
          )
          RETURNING id, username, email, avatar_url, google_id, auth_provider, system_role, created_at
        `;

        console.log('✅ Successfully created new user via Google OAuth:', newUser.email);
        console.log('============================');
        
        return done(null, newUser);

      } catch (error) {
        console.error('❌ Google OAuth Database Error:', error.message);
        console.error('Stack:', error.stack);
        return done(error, null);
      }
    }
  )
);

/**
 * ==========================================
 * GITHUB OAUTH 2.0 STRATEGY
 * ==========================================
 */

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: '/api/v1/auth/github/callback',
      scope: ['user:email'], // Request email access
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // ========================================
        // Extract profile information from GitHub
        // ========================================
        const githubId = profile.id;
        const username = profile.username || profile.displayName || 'User';
        
        // GitHub email can be in different places depending on privacy settings
        let email = profile.emails?.[0]?.value || null;
        
        // If no email (user set email to private), try _json
        if (!email && profile._json?.email) {
          email = profile._json.email;
        }

        const avatar = profile.photos?.[0]?.value || profile.avatar_url || null;

        console.log('=== GitHub OAuth Callback ===');
        console.log('GitHub ID:', githubId);
        console.log('Username:', username);
        console.log('Email:', email);
        console.log('Avatar URL:', avatar);

        // Validate required fields
        if (!email) {
          console.error('❌ GitHub OAuth Error: No email provided (may be private)');
          return done(
            new Error('GitHub email is private. Please make your email public in GitHub settings or use another login method.'), 
            null
          );
        }

        // ========================================
        // Query 1: Find user by GitHub ID
        // ========================================
        console.log('🔍 Query 1: Searching by GitHub ID...');
        const [existingGitHubUser] = await db`
          SELECT id, username, email, avatar_url, github_id, auth_provider, system_role, created_at
          FROM users
          WHERE github_id = ${githubId}
        `;

        if (existingGitHubUser) {
          console.log('✅ Found existing user by GitHub ID:', existingGitHubUser.email);
          return done(null, existingGitHubUser);
        }

        // ========================================
        // Query 2: Find user by Email (Link account)
        // ========================================
        console.log('🔍 Query 2: Searching by Email...');
        const [existingEmailUser] = await db`
          SELECT id, username, email, avatar_url, github_id, auth_provider, system_role, created_at
          FROM users
          WHERE email = ${email.toLowerCase()}
        `;

        if (existingEmailUser) {
          // User exists with this email but hasn't linked GitHub yet
          console.log('🔗 Found existing user by Email, linking GitHub account...');
          
          const [updatedUser] = await db`
            UPDATE users
            SET 
              github_id = ${githubId},
              avatar_url = COALESCE(avatar_url, ${avatar}),
              auth_provider = CASE 
                WHEN auth_provider = 'local' AND password_hash IS NOT NULL 
                THEN 'local' 
                ELSE 'github' 
              END,
              updated_at = NOW()
            WHERE email = ${email.toLowerCase()}
            RETURNING id, username, email, avatar_url, github_id, auth_provider, system_role, created_at
          `;

          console.log('✅ Successfully linked GitHub account to existing user:', updatedUser.email);
          return done(null, updatedUser);
        }

        // ========================================
        // Query 3: Create new user (First time GitHub login)
        // ========================================
        console.log('📝 Query 3: Creating new user...');
        const [newUser] = await db`
          INSERT INTO users (
            username, 
            email, 
            github_id, 
            avatar_url, 
            auth_provider, 
            password_hash
          )
          VALUES (
            ${username}, 
            ${email.toLowerCase()}, 
            ${githubId}, 
            ${avatar}, 
            'github', 
            NULL
          )
          RETURNING id, username, email, avatar_url, github_id, auth_provider, system_role, created_at
        `;

        console.log('✅ Successfully created new user via GitHub OAuth:', newUser.email);
        console.log('============================');
        
        return done(null, newUser);

      } catch (error) {
        console.error('❌ GitHub OAuth Database Error:', error.message);
        console.error('Stack:', error.stack);
        return done(error, null);
      }
    }
  )
);

/**
 * ==========================================
 * SERIALIZE/DESERIALIZE USER
 * ==========================================
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [user] = await db`
      SELECT id, username, email, avatar_url, google_id, github_id, auth_provider, system_role, created_at
      FROM users
      WHERE id = ${id}
    `;
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
