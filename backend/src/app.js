import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import routes from './routes/index.js';
import internalRoutes from './routes/internal.routes.js';
import { errorHandler } from './middlewares/error.js';

const app = express();

app.set('trust proxy', 1);
// Security Middleware
app.use(helmet()); // Secure HTTP headers
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5174' // Vite alternative port
  ],
  credentials: true, // Allow cookies
}));

// Parsing Middleware
app.use(express.json());
app.use(cookieParser()); // Essential for HTTP-only JWTs 

// Passport Initialization (for Google OAuth)
app.use(passport.initialize());

// Routes
app.use('/api/v1', routes);

// Internal API Routes for n8n Integration
// SECURITY: Protected by system key authentication (x-system-key header)
// These endpoints are for server-to-server communication only
app.use('/api/internal', internalRoutes);

// Centralized Error Handling
app.use(errorHandler);

export default app;