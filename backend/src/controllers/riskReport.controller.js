import * as RiskReportModel from '../models/riskReport.model.js';
import * as AIRiskService from '../services/aiRiskService.js';

/**
 * Risk Report Controller
 * 
 * Architecture: Thin orchestration layer
 * - Delegates AI logic to Service Layer (aiRiskService.js)
 * - Delegates DB operations to Model Layer (riskReport.model.js)
 * - Handles HTTP request/response only
 */

/**
 * GET /api/v1/projects/:projectId/risk-report
 * Get latest risk report (cached) or generate new one
 */
export const getLatestRiskReport = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Check cache first
    const cachedReport = await RiskReportModel.getLatestReport(projectId, userId);

    if (cachedReport && AIRiskService.isCacheValid(cachedReport)) {
      return res.status(200).json({
        success: true,
        data: { ...cachedReport, cached: true },
      });
    }

    // Cache miss - generate fresh analysis
    const analysis = await AIRiskService.analyzeProjectRisk(projectId);
    const newReport = await RiskReportModel.createReport(projectId, analysis, userId);

    // Prune old reports in background
    RiskReportModel.pruneOldReports(projectId, 30).catch(console.error);

    return res.status(200).json({
      success: true,
      data: { ...newReport, cached: false },
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

/**
 * GET /api/v1/projects/:projectId/risk-report/history
 */
export const getRiskReportHistory = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    const reports = await RiskReportModel.getReportHistory(
      projectId, userId, Math.min(parseInt(limit), 50)
    );

    return res.status(200).json({
      success: true,
      data: reports,
      meta: { count: reports.length },
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

/**
 * GET /api/v1/projects/:projectId/risk-report/:reportId
 */
export const getRiskReportById = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const userId = req.user.id;

    const report = await RiskReportModel.getReportById(reportId, userId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    handleError(error, res, next);
  }
};

/**
 * GET /api/v1/projects/:projectId/risk-report/trend
 */
export const getRiskTrend = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { days = 30 } = req.query;
    const userId = req.user.id;

    const trend = await RiskReportModel.getRiskTrend(
      projectId, userId, Math.min(parseInt(days), 90)
    );

    return res.status(200).json({ success: true, data: trend });
  } catch (error) {
    handleError(error, res, next);
  }
};

/**
 * POST /api/v1/projects/:projectId/risk-report/analyze
 * Force new analysis (bypass cache)
 */
export const analyzeProjectRisk = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const analysis = await AIRiskService.analyzeProjectRisk(projectId, true);
    const newReport = await RiskReportModel.createReport(projectId, analysis, userId);

    return res.status(201).json({
      success: true,
      message: 'Risk analysis completed',
      data: newReport,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

/**
 * GET /api/v1/teams/:teamId/risk-overview
 */
export const getTeamRiskOverview = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    const overview = await RiskReportModel.getTeamRiskOverview(teamId, userId);

    const stats = {
      totalProjects: overview.length,
      criticalCount: overview.filter(p => p.risk_level === 'Critical').length,
      highCount: overview.filter(p => p.risk_level === 'High').length,
      mediumCount: overview.filter(p => p.risk_level === 'Medium').length,
      lowCount: overview.filter(p => p.risk_level === 'Low').length,
    };

    return res.status(200).json({
      success: true,
      data: { projects: overview, stats },
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

// Error handler helper
const handleError = (error, res, next) => {
  if (error.message.includes('Access denied') || error.message.includes('not a member')) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error.message.includes('not found')) {
    return res.status(404).json({ success: false, message: error.message });
  }
  next(error);
};

export default {
  getLatestRiskReport,
  getRiskReportHistory,
  getRiskReportById,
  getRiskTrend,
  analyzeProjectRisk,
  getTeamRiskOverview,
};
