import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

// Axios instance with credentials for admin API
const adminAxios = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  withCredentials: true,
});

/**
 * Admin API Service
 * All functions call admin-protected endpoints (/api/v1/admin/*)
 */

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Fetch paginated user list
 * @param {Object} params - { page, limit, search, role }
 */
export const fetchUsers = async ({ page = 1, limit = 20, search = '', role = '' } = {}) => {
  const params = { page, limit };
  if (search) params.search = search;
  if (role) params.role = role;

  const response = await adminAxios.get('/users', { params });
  return response.data;
};

/**
 * Fetch a single user by ID
 */
export const fetchUserById = async (userId) => {
  const response = await adminAxios.get(`/users/${userId}`);
  return response.data;
};

/**
 * Update a user's system role
 * @param {number} userId
 * @param {string} role - 'user' | 'admin'
 */
export const updateUserRole = async (userId, role) => {
  const response = await adminAxios.patch(`/users/${userId}/role`, { role });
  return response.data;
};

/**
 * Delete a user account
 */
export const deleteUser = async (userId) => {
  const response = await adminAxios.delete(`/users/${userId}`);
  return response.data;
};

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

/**
 * Fetch platform-wide stats
 */
export const fetchStats = async () => {
  const response = await adminAxios.get('/stats');
  return response.data;
};

/**
 * Fetch admin audit logs
 */
export const fetchAuditLogs = async ({ page = 1, limit = 20 } = {}) => {
  const response = await adminAxios.get('/audit-logs', { params: { page, limit } });
  return response.data;
};
