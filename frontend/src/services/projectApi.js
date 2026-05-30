/**
 * Project API Service
 * Handles all API calls related to projects, tasks, and teams
 * 
 * Security Notes:
 * - Uses credentials: 'include' to send HTTP-only cookies with JWT
 * - All endpoints validate user permissions on the backend
 * - Input sanitization happens on backend via Zod schemas
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include', // Send cookies (JWT token)
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
 * Get project details by ID
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getProject(projectId) {
  return apiFetch(`/projects/${projectId}`);
}

/**
 * Get all members of a project
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getProjectMembers(projectId) {
  return apiFetch(`/projects/${projectId}/members`);
}

/**
 * Get all tasks in a project
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getProjectTasks(projectId) {
  return apiFetch(`/projects/${projectId}/tasks`);
}

/**
 * Get project statistics (task counts by status)
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getProjectStats(projectId) {
  return apiFetch(`/projects/${projectId}/stats`);
}

/**
 * Create a new task
 * @param {number} projectId 
 * @param {object} taskData - {title, description?, status?, priority?, assignee_id?, due_date?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function createTask(projectId, taskData) {
  return apiFetch(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

/**
 * Update an existing task
 * @param {number} projectId 
 * @param {number} taskId 
 * @param {object} updates - {title?, description?, status?, priority?, assignee_id?, due_date?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function updateTask(projectId, taskId, updates) {
  return apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a task
 * @param {number} projectId 
 * @param {number} taskId 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteTask(projectId, taskId) {
  return apiFetch(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// ==================== TEAM API FUNCTIONS ====================

/**
 * Get all teams for the authenticated user
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getUserTeams() {
  return apiFetch('/teams');
}

/**
 * Get team details by ID
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getTeam(teamId) {
  return apiFetch(`/teams/${teamId}`);
}

/**
 * Get all members of a team
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getTeamMembers(teamId) {
  return apiFetch(`/teams/${teamId}/members`);
}

/**
 * Get all projects in a team
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, data: array}>}
 */
export async function getTeamProjects(teamId) {
  return apiFetch(`/teams/${teamId}/projects`);
}

/**
 * Get team statistics (overview metrics)
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, data: object}>}
 */
export async function getTeamStats(teamId) {
  return apiFetch(`/teams/${teamId}/stats`);
}

/**
 * Create a new team
 * @param {object} teamData - {name, description?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function createTeam(teamData) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(teamData),
  });
}

/**
 * Update team details
 * @param {number} teamId 
 * @param {object} updates - {name?, description?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function updateTeam(teamId, updates) {
  return apiFetch(`/teams/${teamId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a team
 * @param {number} teamId 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteTeam(teamId) {
  return apiFetch(`/teams/${teamId}`, {
    method: 'DELETE',
  });
}

/**
 * Create a new project
 * @param {number} teamId 
 * @param {object} projectData - {name, description?, status?, start_date?, end_date?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function createProject(teamId, projectData) {
  return apiFetch(`/teams/${teamId}/projects`, {
    method: 'POST',
    body: JSON.stringify(projectData),
  });
}

/**
 * Update a project
 * @param {number} teamId 
 * @param {number} projectId 
 * @param {object} updates - {name?, description?, status?, start_date?, end_date?}
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function updateProject(teamId, projectId, updates) {
  return apiFetch(`/teams/${teamId}/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a project
 * @param {number} teamId 
 * @param {number} projectId 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteProject(teamId, projectId) {
  return apiFetch(`/teams/${teamId}/projects/${projectId}`, {
    method: 'DELETE',
  });
}

/**
 * Add a member to a project
 * @param {number} projectId 
 * @param {number} userId 
 * @param {string} role - 'lead', 'editor', or 'viewer'
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function addProjectMember(projectId, userId, role = 'viewer') {
  return apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
}

/**
 * Remove a member from a project
 * @param {number} projectId 
 * @param {number} userId 
 * @param {boolean} forceRemove - If true, unassign tasks before removing
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function removeProjectMember(projectId, userId, forceRemove = false) {
  return apiFetch(`/projects/${projectId}/members/${userId}?forceRemove=${forceRemove}`, {
    method: 'DELETE',
  });
}

/**
 * Update a project member's role
 * @param {number} projectId 
 * @param {number} userId 
 * @param {string} role - 'lead', 'editor', or 'viewer'
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function updateProjectMemberRole(projectId, userId, role) {
  return apiFetch(`/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// ==================== INVITATION API ====================
// NOTE: getUserInvitations, acceptInvitation, declineInvitation, getInvitationPreview
// have been moved to notificationApi.js for centralized notification handling

/**
 * Search users for team invitation (with status indicators)
 * @param {number} teamId - Team ID
 * @param {string} query - Search query (username or email)
 * @returns {Promise<{success: boolean, data: Array<{id, username, email, avatar_url, status}>}>}
 */
export async function searchUsers(teamId, query) {
  return apiFetch(`/teams/${teamId}/search-users?q=${encodeURIComponent(query)}`);
}

/**
 * Create a team invitation
 * @param {number} teamId - Team ID
 * @param {string} email - Email to invite
 * @param {string} role - Role ('member' or 'admin')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function createInvitation(teamId, email, role = 'member') {
  return apiFetch(`/teams/${teamId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

// ==================== TEAM MEMBER MANAGEMENT ====================

/**
 * Remove a member from a team
 * @param {number} teamId - Team ID
 * @param {number} userId - User ID to remove
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function removeTeamMember(teamId, userId) {
  return apiFetch(`/teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Update a team member's role
 * @param {number} teamId - Team ID
 * @param {number} userId - User ID
 * @param {string} role - Role ('member', 'admin', or 'owner')
 * @returns {Promise<{success: boolean, message: string, data: object}>}
 */
export async function updateTeamMemberRole(teamId, userId, role) {
  return apiFetch(`/teams/${teamId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
// ==================== TEAM INVITATIONS ====================

/**
 * Get pending invitations for a team
 * @param {number} teamId - Team ID
 * @returns {Promise<{success: boolean, data: Array}>}
 */
export async function getTeamPendingInvitations(teamId) {
  return apiFetch(`/teams/${teamId}/invitations`);
}

/**
 * Revoke a pending invitation
 * @param {number} teamId - Team ID
 * @param {number} invitationId - Invitation ID to revoke
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function revokeInvitation(teamId, invitationId) {
  return apiFetch(`/teams/${teamId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

/**
 * Leave a team (for non-owner members)
 * @param {number} teamId - Team ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function leaveTeam(teamId) {
  return apiFetch(`/teams/${teamId}/leave`, {
    method: 'POST',
  });
}