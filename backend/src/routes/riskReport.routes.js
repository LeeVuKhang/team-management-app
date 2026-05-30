import express from 'express';
import * as RiskReportController from '../controllers/riskReport.controller.js';
import { validate } from '../middlewares/validate.js';
import { verifyToken } from '../middlewares/auth.js';
import {
  projectIdParamSchema,
  reportIdParamSchema,
  historyQuerySchema,
  trendQuerySchema,
} from '../validations/riskReport.validation.js';

/**
 * Risk Report Routes
 * Mounted at: /api/v1/projects/:projectId/risk-report
 */

const router = express.Router({ mergeParams: true });

router.use(verifyToken);

// GET /risk-report - Get latest (cached)
router.get('/',
  validate({ params: projectIdParamSchema }),
  RiskReportController.getLatestRiskReport
);

// GET /risk-report/history
router.get('/history',
  validate({ params: projectIdParamSchema, query: historyQuerySchema }),
  RiskReportController.getRiskReportHistory
);

// GET /risk-report/trend
router.get('/trend',
  validate({ params: projectIdParamSchema, query: trendQuerySchema }),
  RiskReportController.getRiskTrend
);

// GET /risk-report/:reportId
router.get('/:reportId',
  validate({ params: reportIdParamSchema }),
  RiskReportController.getRiskReportById
);

// POST /risk-report/analyze - Force new analysis
router.post('/analyze',
  validate({ params: projectIdParamSchema }),
  RiskReportController.analyzeProjectRisk
);

export default router;
