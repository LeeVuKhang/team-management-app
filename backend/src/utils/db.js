import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("FATAL: DATABASE_URL is not defined in .env file");
}

/**
 * Database Connection Configuration
 * Optimized for Render + Supabase Pooler setup
 * 
 * Key settings to prevent CONNECT_TIMEOUT:
 * - connect_timeout: 60s (long enough for cold starts)
 * - idle_timeout: 0 (keep connections alive)
 * - max_lifetime: 30 mins (force reconnect periodically)
 * - prepare: false (required for Supabase Transaction Pooler)
 */
const db = postgres(connectionString, {
  ssl: 'require',

  // Connection pool settings
  max: 5,                    // Reduced from 10 - Supabase free tier has limited connections
  idle_timeout: 0,           // Keep connections alive (don't close idle connections)
  max_lifetime: 60 * 30,     // 30 minutes - force reconnect to prevent stale connections

  // Timeout settings (in seconds)
  connect_timeout: 60,       // 60s timeout for initial connection (handles cold starts)

  // Required for Supabase Transaction Pooler (PgBouncer)
  prepare: false,            // Disable prepared statements (not supported by PgBouncer in transaction mode)

  // Connection retry settings
  connection: {
    application_name: 'team-management-app',
  },

  // Transform column names (optional - keeps consistency)
  transform: {
    undefined: null,         // Transform undefined to null
  },

  // Error handler for connection issues
  onnotice: (notice) => {
    console.log('[DB Notice]', notice.message);
  },
});

// Log connection status
db.options.debug = process.env.NODE_ENV === 'development';

// Keep-alive query to prevent connection drops
// Run every 4 minutes (before Render's 5-minute idle check)
const KEEP_ALIVE_INTERVAL = 3 * 60 * 1000; // 3 minutes

const keepAlive = async () => {
  try {
    await db`SELECT 1`;
    console.log('[DB] Keep-alive ping successful');
  } catch (err) {
    console.error('[DB] Keep-alive failed:', err.message);
  }
};

// Only run keep-alive in production
if (process.env.NODE_ENV === 'production') {
  setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
  console.log('[DB] Keep-alive enabled (every 3 minutes)');
}

export default db;
