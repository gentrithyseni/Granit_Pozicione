import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from './LoadingScreen';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, session, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (!hasSupabaseConfig) {
    return <>{children}</>;
  }

  const profileCheckPending = Boolean(session?.user && profile?.id !== session.user.id);
  if (loading || profileLoading || profileCheckPending) {
    return <LoadingScreen title="Duke kontrolluar qasjen" subtitle="Po verifikohet profili..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
