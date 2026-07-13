import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  resetPassword: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
  });

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      recoveryMode,
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar', needsConfirmation: false };
        const { data, error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null, needsConfirmation: Boolean(data.user && !data.session) };
      },
      resetPassword: async (email, redirectTo) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar' };
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return { error: error?.message ?? null };
      },
      updatePassword: async (password) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar' };
        const { error } = await supabase.auth.updateUser({ password });
        if (!error) setRecoveryMode(false);
        return { error: error?.message ?? null };
      },
      changePassword: async (currentPassword, newPassword) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar' };
        const email = user?.email;
        if (!email) return { error: 'Email-i i perdoruesit nuk u gjet' };

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
        if (signInError) return { error: 'Password-i aktual nuk eshte i sakte' };

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [user, session, loading, recoveryMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
