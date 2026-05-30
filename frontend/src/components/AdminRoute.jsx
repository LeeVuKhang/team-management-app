import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Admin Route Guard
 * Protects admin-only routes by checking:
 * 1. User is authenticated
 * 2. User has 'admin' system role
 * 
 * Note: This is a UI-level guard ONLY. Real authorization is enforced
 * server-side via verifySystemRole middleware with live DB checks.
 */
export default function AdminRoute() {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Not admin → redirect to dashboard (don't reveal admin panel exists)
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
