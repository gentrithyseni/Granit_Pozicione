import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type LoginValues = { email: string; password: string };

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<LoginValues>({ defaultValues: { email: '', password: '' } });

  const from = (location.state as { from?: string } | null)?.from || '/';

  if (user) return <Navigate to={from} replace />;

  if (!hasSupabaseConfig) {
    return (
      <div className="auth-page">
        <div className="auth-card card">
          <h1>Hyrje</h1>
          <p className="muted">Konfiguro VITE_SUPABASE_URL dhe VITE_SUPABASE_ANON_KEY në .env</p>
          <button type="button" className="primary-button" onClick={() => navigate('/')}>Vazhdo pa auth</button>
        </div>
      </div>
    );
  }

  const onSubmit = async (values: LoginValues) => {
    setLoading(true);
    setError(null);
    const { error: signInError } = await signIn(values.email, values.password);
    setLoading(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="eyebrow accent">Graniti</div>
        <h1>Hyrje në panel</h1>
        <p className="muted">Shkruaj email dhe password.</p>
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Email
            <input type="email" autoComplete="email" {...register('email', { required: true })} placeholder="email@shembull.com" />
          </label>
          <label>
            Fjalëkalimi
            <input type="password" autoComplete="current-password" {...register('password', { required: true })} placeholder="********" />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Hyr'}
          </button>
        </form>
      </div>
    </div>
  );
}
