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
    console.error(`Team API Error [${endpoint}]:`, error);
    throw error;
  }
}

export async function getUserTeams() {
  return apiFetch('/teams');
}

export async function createTeam(payload) {
  return apiFetch('/teams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export default {
  getUserTeams,
  createTeam,
};
