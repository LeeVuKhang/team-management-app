import db from '../utils/db.js';

/**
 * Risk Report Model
 * Handles database operations for project_risk_reports table
 * 
 * Security:
 * - All queries verify user has project access (IDOR prevention)
 * - Uses parameterized queries via postgres.js (SQL injection prevention)
 */

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get the latest risk report for a project
 */
export const getLatestReport = async (projectId, userId) => {
  await verifyProjectAccess(projectId, userId);

  const [report] = await db`
    SELECT id, project_id, risk_score, risk_level, summary,
           risk_factors, suggested_actions, analysis_context, created_at
    FROM project_risk_reports
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return report || null;
};

/**
 * Get risk report history for a project
 */
export const getReportHistory = async (projectId, userId, limit = 10) => {
  await verifyProjectAccess(projectId, userId);

  return await db`
    SELECT id, project_id, risk_score, risk_level, summary,
           risk_factors, suggested_actions, created_at
    FROM project_risk_reports
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
};

/**
 * Get a specific risk report by ID
 */
export const getReportById = async (reportId, userId) => {
  const [report] = await db`
    SELECT r.*, p.name as project_name
    FROM project_risk_reports r
    JOIN projects p ON r.project_id = p.id
    WHERE r.id = ${reportId}
  `;

  if (!report) return null;

  await verifyProjectAccess(report.project_id, userId);
  return report;
};

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new risk report (cache AI analysis result)
 */
export const createReport = async (projectId, analysisResult, userId) => {
  await verifyProjectAccess(projectId, userId);

  const { riskScore, riskLevel, summary, riskFactors, suggestedActions, context } = analysisResult;

  const [report] = await db`
    INSERT INTO project_risk_reports (
      project_id, risk_score, risk_level, summary,
      risk_factors, suggested_actions, analysis_context
    ) VALUES (
      ${projectId}, ${riskScore}, ${riskLevel}, ${summary},
      ${JSON.stringify(riskFactors)}, ${JSON.stringify(suggestedActions)},
      ${JSON.stringify(context || {})}
    )
    RETURNING *
  `;

  return report;
};

/**
 * Delete old reports to manage storage
 */
export const pruneOldReports = async (projectId, keepCount = 30) => {
  const reportsToKeep = await db`
    SELECT id FROM project_risk_reports
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${keepCount}
  `;

  const keepIds = reportsToKeep.map(r => r.id);
  if (keepIds.length === 0) return 0;

  const result = await db`
    DELETE FROM project_risk_reports
    WHERE project_id = ${projectId} AND id != ALL(${keepIds})
  `;

  return result.count || 0;
};

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get risk trend for a project over time
 */
export const getRiskTrend = async (projectId, userId, days = 30) => {
  await verifyProjectAccess(projectId, userId);

  return await db`
    SELECT DATE(created_at) as date, risk_score, risk_level
    FROM project_risk_reports
    WHERE project_id = ${projectId}
      AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    ORDER BY created_at ASC
  `;
};

/**
 * Get risk overview for all projects in a team
 */
export const getTeamRiskOverview = async (teamId, userId) => {
  // Verify team membership
  const [membership] = await db`
    SELECT role FROM team_members
    WHERE team_id = ${teamId} AND user_id = ${userId}
  `;

  if (!membership) {
    throw new Error('Access denied: User is not a member of this team');
  }

  return await db`
    SELECT DISTINCT ON (p.id)
      p.id as project_id, p.name as project_name, p.status as project_status,
      r.risk_score, r.risk_level, r.summary, r.created_at as last_analyzed
    FROM projects p
    LEFT JOIN project_risk_reports r ON p.id = r.project_id
    WHERE p.team_id = ${teamId}
    ORDER BY p.id, r.created_at DESC NULLS LAST
  `;
};

// ============================================================================
// HELPER
// ============================================================================

const verifyProjectAccess = async (projectId, userId) => {
  const [access] = await db`
    SELECT 1 FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${userId}
  `;

  if (!access) {
    throw new Error('Access denied: User is not a member of this project');
  }
};

export default {
  getLatestReport,
  getReportHistory,
  getReportById,
  createReport,
  pruneOldReports,
  getRiskTrend,
  getTeamRiskOverview,
};
