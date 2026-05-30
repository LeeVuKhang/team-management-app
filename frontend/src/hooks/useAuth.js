import { useQuery } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://new-tech-be.onrender.com/api/v1';

/**
 * Fetch current authenticated user
 * @returns {Promise<Object>} User object with id, username, email, avatar_url
 */
const fetchCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include', // Send HTTP-only cookies
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch user');
  }

  const data = await response.json();
  return data.data.user; // Returns { id, username, email, avatar_url, created_at }
};

/**
 * Custom hook to get current authenticated user
 * Uses React Query for caching and automatic refetching
 * 
 * @returns {{
 *   user: Object | undefined,
 *   isLoading: boolean,
 *   isError: boolean,
 *   error: Error | null
 * }}
 * 
 * @example
 * const { user, isLoading, isError } = useAuth();
 * if (isLoading) return <div>Loading...</div>;
 * if (isError) return <div>Please login</div>;
 * return <div>Hello {user.username}</div>;
 */
export const useAuth = () => {
  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 401 (unauthenticated)
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
  });

  return {
    user,
    isLoading,
    isError,
    error,
    isAdmin: user?.system_role === 'admin',  // UI convenience only — real auth is server-side
  };
};
