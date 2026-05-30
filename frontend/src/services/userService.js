import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send HTTP-only cookies
});

/**
 * Get current authenticated user profile
 * @returns {Promise<Object>} User profile with OAuth link status
 */
export const getMe = async () => {
  const response = await axiosInstance.get('/users/me');
  return response.data;
};

/**
 * Update current user profile
 * @param {FormData} formData - Form data containing username and/or avatar file
 * @returns {Promise<Object>} Updated user profile
 */
export const updateProfile = async (formData) => {
  const response = await axiosInstance.put('/users/me', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Unlink OAuth provider from account
 * @param {string} provider - 'google' or 'github'
 * @returns {Promise<Object>} Updated user profile
 */
export const unlinkOAuthProvider = async (provider) => {
  const response = await axiosInstance.delete(`/users/me/oauth/${provider}`);
  return response.data;
};

export default {
  getMe,
  updateProfile,
  unlinkOAuthProvider,
};