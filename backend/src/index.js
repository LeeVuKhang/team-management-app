import { createServer } from 'http';
import app from './app.js';
import db from './utils/db.js';
import { initializeSocket } from './socket/index.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server (required for Socket.io)
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Expose io instance for potential use in controllers (optional)
app.set('io', io);

// Test DB connection before starting server
db`SELECT 1`.then(() => {
  console.log('Database connected successfully to Supabase');
  
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io ready for connections`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});