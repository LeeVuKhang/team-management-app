import express from 'express';
// Import individual route files
import authRoutes from './auth.routes.js';
import projectRoutes, { teamProjectRouter } from './project.routes.js';
import teamRoutes from './team.routes.js';
import invitationRoutes from './invitation.routes.js';
import channelRoutes from './channel.routes.js';
import riskReportRoutes from './riskReport.routes.js';
import notificationRoutes from './notification.routes.js';
import taskRoutes from './task.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import { verifyToken } from '../middlewares/auth.js';
import * as RiskReportController from '../controllers/riskReport.controller.js';
import { validate } from '../middlewares/validate.js';
import { teamIdParamSchema } from '../validations/riskReport.validation.js';

const router = express.Router();

router.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Mount routes
router.use('/auth', authRoutes); // Authentication endpoints
router.use('/users', userRoutes); // User profile endpoints (auth applied in route file)
router.use('/teams', verifyToken, teamRoutes); // Protected routes
router.use('/teams/:teamId/projects', verifyToken, teamProjectRouter); // Protected routes
router.use('/teams/:teamId/channels', channelRoutes); // Channel/Message routes (real-time chat)
router.use('/projects', verifyToken, projectRoutes); // Protected routes
router.use('/projects/:projectId/risk-report', riskReportRoutes); // AI Risk Analysis routes
router.use('/notifications', notificationRoutes); // User notification routes (JWT protected internally)
router.use('/tasks', taskRoutes); // Task management routes
router.use('/', verifyToken, invitationRoutes); // Protected routes (user invitations + accept/decline)

// Admin Portal routes (verifyToken at mount, verifySystemRole inside admin.routes.js)
router.use('/admin', verifyToken, adminRoutes);

// Team-level risk overview
router.get('/teams/:teamId/risk-overview',
  verifyToken,
  validate({ params: teamIdParamSchema }),
  RiskReportController.getTeamRiskOverview
);

export default router;