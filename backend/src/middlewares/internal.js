/**
 * Internal API Middleware for n8n Integration
 * 
 * SECURITY: Server-to-server authentication using API secret key.
 * These endpoints are NOT for user clients - they're for automated systems like n8n.
 * 
 * Why not use JWT?
 * - n8n is a server, not a user. It doesn't have a user session.
 * - API keys are simpler and more appropriate for service-to-service communication.
 * - The secret is stored in environment variables, never exposed to clients.
 */

import crypto from 'crypto';

/**
 * Verify system API key for internal endpoints
 * SECURITY: Only allows requests with valid N8N_SECRET_KEY in header
 * 
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export const verifySystemKey = (req, res, next) => {
  const systemKey = req.headers['x-system-key'];
  const expectedKey = process.env.N8N_SECRET_KEY;

  // SECURITY: Ensure the secret key is configured
  if (!expectedKey) {
    console.error('CRITICAL: N8N_SECRET_KEY is not configured in environment variables');
    return res.status(500).json({
      success: false,
      error: 'Internal server configuration error',
    });
  }

  // SECURITY: Validate the provided key
  if (!systemKey) {
    console.warn('Internal API call rejected: Missing x-system-key header');
    return res.status(401).json({
      success: false,
      error: 'Authentication required: Missing system key',
    });
  }

  // SECURITY: Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(systemKey, expectedKey)) {
    console.warn('Internal API call rejected: Invalid system key');
    return res.status(403).json({
      success: false,
      error: 'Unauthorized: Invalid system key',
    });
  }

  // Mark request as internal for logging/auditing
  req.isInternalCall = true;
  req.internalSource = 'n8n';

  next();
};

/**
 * Constant-time string comparison to prevent timing attacks
 * SECURITY: Prevents attackers from guessing the key character by character
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Ensure both strings have the same length for comparison
  const lenA = Buffer.byteLength(a, 'utf8');
  const lenB = Buffer.byteLength(b, 'utf8');

  // Use crypto.timingSafeEqual for secure comparison
  const bufA = Buffer.alloc(Math.max(lenA, lenB), 0);
  const bufB = Buffer.alloc(Math.max(lenA, lenB), 0);
  
  Buffer.from(a, 'utf8').copy(bufA);
  Buffer.from(b, 'utf8').copy(bufB);
  
  return lenA === lenB && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Rate limiter for internal API endpoints
 * SECURITY: Prevents n8n from overwhelming the server with requests
 * 
 * Note: In production, consider using redis-based rate limiting
 * for distributed environments.
 */
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

export const internalRateLimiter = (req, res, next) => {
  const key = req.headers['x-system-key'] || 'unknown';
  const now = Date.now();

  // Clean up old entries
  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 0, windowStart: now });
  }

  const record = requestCounts.get(key);

  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`Rate limit exceeded for internal API: ${record.count} requests`);
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please use batching.',
      retryAfter: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
    });
  }

  next();
};
