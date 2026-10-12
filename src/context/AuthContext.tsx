import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchMyProfile, markApprovalNoticeSeen } from '../services/userManagement';
import type { DbProfile } from '../types/database';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const DAILY_LOGIN_LIMIT = 5;
const LOGIN_ATTEMPT_STORAGE_KEY = 'graniti-login-attempts';

type LoginAttemptState = { date: string; count: number };

function getLoginAttemptState(email: string): LoginAttemptState {
  if (typeof window === 'undefined') return { date: '', count: 0 };
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY) || '{}') as Record<string, LoginAttemptState>;
    const today = new Date().toISOString().slice(0, 10);
    const state = stored[email.toLowerCase()];
    return state?.date === today ? state : { date: today, count: 0 };
  } catch {
    return { date: new Date().toISOString().slice(0, 10), count: 0 };
  }
}

function recordFailedLogin(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY) || '{}') as Record<string, LoginAttemptState>;
    const state = getLoginAttemptState(email);
    stored[email.toLowerCase()] = { date: state.date, count: state.count + 1 };
    window.localStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Supabase still applies server-side rate limits.
  }
}

function clearLoginAttempts(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY) || '{}') as Record<string, LoginAttemptState>;
    delete stored[email.toLowerCase()];
    window.localStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The daily limit expires automatically.
  }
}

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: DbProfile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  loading: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; status?: DbProfile['status']; approvalNotice?: boolean; blocked?: boolean }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null; needsConfirmation: boolean; needsApproval: boolean }>;
  resetPassword: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<number | null>(null);
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

  const sessionUserId = session?.user.id;

  useEffect(() => {
    if (!sessionUserId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    fetchMyProfile(sessionUserId).then((nextProfile) => {
      if (!active) return;
      setProfile(nextProfile);
      setProfileLoading(false);

      if (!nextProfile || nextProfile.status !== 'approved') {
        setUser(null);
        setSession(null);
        void supabase?.auth.signOut();
      }
    });

    return () => {
      active = false;
    };
  }, [sessionUserId]);

  useEffect(() => {
    if (!supabase || !user) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const resetInactivityTimer = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      resetInactivityTimer();
    };

    resetInactivityTimer();

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'pointerdown'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      profileLoading,
      isAdmin: profile?.role === 'admin' && profile.status === 'approved',
      loading,
      recoveryMode,
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar' };
        const attempts = getLoginAttemptState(email);
        if (attempts.count >= DAILY_LOGIN_LIMIT) {
          return { error: 'Nuk lejohesh të provosh më sot. Ke arritur limitin prej 5 tentativash.', blocked: true };
        }
        let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
        let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];
        try {
          const result = await Promise.race([
            supabase.auth.signInWithPassword({ email, password }),
            new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Supabase nuk u përgjigj brenda 12 sekondave.')), 12000)),
          ]);
          data = result.data;
          error = result.error;
        } catch (requestError) {
          return { error: requestError instanceof Error ? requestError.message : 'Gabim gjatë lidhjes me Supabase.' };
        }
        if (error) {
          recordFailedLogin(email);
          const nextAttempts = getLoginAttemptState(email);
          if (nextAttempts.count >= DAILY_LOGIN_LIMIT) {
            return { error: 'Nuk lejohesh të provosh më sot. Ke arritur limitin prej 5 tentativash.', blocked: true };
          }
          return { error: error.message };
        }
        if (!data.user) return { error: 'Hyrja nuk u kompletua.' };

        const nextProfile = await fetchMyProfile(data.user.id);
        if (!nextProfile || nextProfile.status !== 'approved') {
          await supabase.auth.signOut();
          recordFailedLogin(email);
          const blocked = getLoginAttemptState(email).count >= DAILY_LOGIN_LIMIT;
          if (blocked) return { error: 'Nuk lejohesh të provosh më sot. Ke arritur limitin prej 5 tentativash.', blocked: true };
          if (!nextProfile) return { error: 'Profili nuk është konfiguruar ende. Kontakto administratorin.' };
          if (nextProfile.status === 'rejected') return { error: 'Kërkesa juaj është refuzuar.' };
          if (nextProfile.status === 'suspended') return { error: 'Kjo llogari është pezulluar.' };
          return { error: 'Llogaria është në pritje të aprovimit nga administratori.' };
        }

        clearLoginAttempts(email);
        const approvalNotice = !nextProfile.approval_notice_seen_at;
        if (approvalNotice) await markApprovalNoticeSeen();
        return { error: null, status: nextProfile.status, approvalNotice };
      },
      signUp: async (email, password, fullName) => {
        if (!supabase) return { error: 'Supabase nuk eshte i konfiguruar', needsConfirmation: false, needsApproval: false };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName?.trim() || null } },
        });
        const needsConfirmation = Boolean(data.user && !data.session);
        const needsApproval = Boolean(data.user);
        if (data.session) await supabase.auth.signOut();
        return { error: error?.message ?? null, needsConfirmation, needsApproval };
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
    [user, session, profile, profileLoading, loading, recoveryMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
