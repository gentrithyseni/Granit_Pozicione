import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { MoonStar, SunMedium } from 'lucide-react';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

type AuthMode = 'login' | 'register' | 'forgot' | 'updatePassword';
type AuthValues = { email: string; password: string; confirmPassword: string };

const modeCopy: Record<AuthMode, { title: string; description: string; submit: string; loading: string }> = {
  login: {
    title: 'Hyrje ne panel',
    description: 'Shkruaj email dhe password.',
    submit: 'Login',
    loading: 'Duke hyre...',
  },
  register: {
    title: 'Regjistro llogari',
    description: 'Krijo nje llogari te re.',
    submit: 'Regjistrohu',
    loading: 'Duke u regjistruar...',
  },
  forgot: {
    title: 'Rikthe password-in',
    description: 'Shkruaj email-in dhe do te dergohet linku per ndryshim password-i.',
    submit: 'Dergo linkun',
    loading: 'Duke derguar...',
  },
  updatePassword: {
    title: 'Vendos password te ri',
    description: 'Shkruaj password-in e ri per llogarine tende.',
    submit: 'Ruaj password-in',
    loading: 'Duke ruajtur...',
  },
};

export function LoginPage() {
  const { user, recoveryMode, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'updatePassword' : 'login');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<AuthValues>({
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const from = (location.state as { from?: string } | null)?.from || '/';
  const copy = modeCopy[mode];

  useEffect(() => {
    if (recoveryMode) setMode('updatePassword');
  }, [recoveryMode]);

  if (user && !recoveryMode) return <Navigate to={from} replace />;

  if (!hasSupabaseConfig) {
    return (
      <div className="auth-page">
        <div className="auth-card card">
          <div className="auth-card-topbar">
            <button type="button" className="card theme-toggle-btn auth-theme-toggle" onClick={toggleTheme} aria-label="Ndërro temën">
              {theme === 'light' ? <MoonStar size={18} /> : <SunMedium size={18} />} {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
          <h1>Hyrje</h1>
          <p className="muted">Konfiguro VITE_SUPABASE_URL dhe VITE_SUPABASE_ANON_KEY ne .env</p>
          <button type="button" className="primary-button" onClick={() => navigate('/')}>Vazhdo pa auth</button>
        </div>
      </div>
    );
  }

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
    reset({ email: '', password: '', confirmPassword: '' });
  };

  const onSubmit = async (values: AuthValues) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    if ((mode === 'register' || mode === 'updatePassword') && values.password !== values.confirmPassword) {
      setError('Password-et nuk perputhen.');
      setLoading(false);
      return;
    }

    if (mode === 'login') {
      const { error: signInError } = await signIn(values.email, values.password);
      setLoading(false);
      if (signInError) {
        setError(signInError);
        return;
      }
      navigate(from, { replace: true });
      return;
    }

    if (mode === 'register') {
      const { error: signUpError, needsConfirmation } = await signUp(values.email, values.password);
      setLoading(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      if (needsConfirmation) {
        setMessage('Regjistrimi perfundoi. Kontrollo email-in per konfirmim, pastaj hyr ne webfaqe.');
        setMode('login');
        reset({ email: values.email, password: '', confirmPassword: '' });
        return;
      }
      navigate(from, { replace: true });
      return;
    }

    if (mode === 'forgot') {
      const redirectTo = `${window.location.origin}/login`;
      const { error: resetError } = await resetPassword(values.email, redirectTo);
      setLoading(false);
      if (resetError) {
        setError(resetError);
        return;
      }
      setMessage('Linku per ndryshim password-i u dergua. Kontrollo email-in.');
      reset({ email: values.email, password: '', confirmPassword: '' });
      return;
    }

    const { error: updateError } = await updatePassword(values.password);
    setLoading(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setMessage('Password-i u ndryshua me sukses. Tani mund te hysh ne webfaqe.');
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-card-topbar">
          <button type="button" className="card theme-toggle-btn auth-theme-toggle" onClick={toggleTheme} aria-label="Ndërro temën">
            {theme === 'light' ? <MoonStar size={18} /> : <SunMedium size={18} />} {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        <div className="eyebrow accent">Sistem Menaxhimi për Projekte dhe Oferta</div>
        <h1>{copy.title}</h1>
        <p className="muted">{copy.description}</p>

        {mode !== 'updatePassword' && (
          <div className="auth-tabs" aria-label="Auth options">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>
              Regjistrohu
            </button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <label>
              Email
              <input type="email" autoComplete="email" {...register('email', { required: true })} placeholder="email@shembull.com" />
            </label>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'updatePassword') && (
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                {...register('password', { required: true, minLength: 6 })}
                placeholder="********"
              />
            </label>
          )}

          {(mode === 'register' || mode === 'updatePassword') && (
            <label>
              Perserit password-in
              <input
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword', { required: true, minLength: 6 })}
                placeholder="********"
              />
            </label>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? copy.loading : copy.submit}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className="link-button auth-inline-action" onClick={() => changeMode('forgot')}>
            Forget password ?
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link-button auth-inline-action" onClick={() => changeMode('login')}>
            Kthehu te hyrja
          </button>
        )}
      </div>
    </div>
  );
}
