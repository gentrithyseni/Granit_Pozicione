import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (!hasSupabaseConfig) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <p className="muted">Duke u ngarkuar...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
