const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

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
    console.error(`Task API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Get all tasks assigned to the authenticated user
 */
export const getUserTasks = async () => {
  return apiFetch('/tasks/my-tasks');
};

/**
 * Get task statistics for the authenticated user
 */
export const getUserTaskStats = async () => {
  const response = await axiosInstance.get('/tasks/my-stats');
  return response.data;
};

/**
 * Get a single task by ID
 */
export const getTaskById = async (taskId) => {
  const response = await axiosInstance.get(`/tasks/${taskId}`);
  return response.data;
};

/**
 * Get all tasks for a project
 */
export const getProjectTasks = async (projectId) => {
  const response = await axiosInstance.get(`/tasks/project/${projectId}`);
  return response.data;
};

/**
 * Create a new task
 */
export const createTask = async (taskData) => {
  const response = await axiosInstance.post('/tasks', taskData);
  return response.data;
};

/**
 * Update a task
 */
export const updateTask = async (taskId, updates) => {
  const response = await axiosInstance.put(`/tasks/${taskId}`, updates);
  return response.data;
};

/**
 * Delete a task
 */
export const deleteTask = async (taskId) => {
  const response = await axiosInstance.delete(`/tasks/${taskId}`);
  return response.data;
};
