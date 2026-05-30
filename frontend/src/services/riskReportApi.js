/**
 * Risk Report API Service
 * Handles all API calls related to AI-powered project risk analysis
 * 
 * Security Notes:
 * - Uses credentials: 'include' to send HTTP-only cookies with JWT
 * - All endpoints validate user permissions on the backend
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Get the latest risk report for a project (uses cache)
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getLatestRiskReport(projectId) {
  return apiFetch(`/projects/${projectId}/risk-report`);
}

/**
 * Force a new AI risk analysis (bypasses cache)
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function analyzeProjectRisk(projectId) {
  return apiFetch(`/projects/${projectId}/risk-report/analyze`, {
    method: 'POST',
  });
}

/**
 * Get risk report history for a project
 * @param {number} projectId 
 * @param {number} limit - Number of reports to return (default: 10)
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getRiskReportHistory(projectId, limit = 10) {
  return apiFetch(`/projects/${projectId}/risk-report/history?limit=${limit}`);
}

/**
 * Get risk trend data over time
 * @param {number} projectId 
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getRiskTrend(projectId, days = 30) {
  return apiFetch(`/projects/${projectId}/risk-report/trend?days=${days}`);
}

/**
 * Get risk overview for all projects in a team
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getTeamRiskOverview(teamId) {
  return apiFetch(`/teams/${teamId}/risk-overview`);
}

export default {
  getLatestRiskReport,
  analyzeProjectRisk,
  getRiskReportHistory,
  getRiskTrend,
  getTeamRiskOverview,
};
