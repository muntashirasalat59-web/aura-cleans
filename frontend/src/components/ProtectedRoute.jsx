import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingState from './LoadingState';
import { defaultHomeForRole, isPathAllowed } from '../config/permissions';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, profileLoading, session, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] dark:bg-slate-950 transition-colors duration-200">
        <LoadingState message="Checking session…" />
      </div>
    );
  }

  if (session?.access_token && profileLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] dark:bg-slate-950 transition-colors duration-200">
        <LoadingState message="Loading your account…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && !isPathAllowed(role, location.pathname)) {
    return <Navigate to={defaultHomeForRole(role)} replace />;
  }

  return children;
}
