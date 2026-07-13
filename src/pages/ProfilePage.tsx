import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { exportAllDataJson } from '../services/projects';

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ProfilePage() {
  const { user, changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<PasswordFormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleBackup = async () => {
    const result = await exportAllDataJson();
    if (result.ok) showToast('Backup JSON u shkarkua.', 'success');
    else showToast(result.message || 'Gabim', 'error');
  };

  const handlePasswordChange = async (values: PasswordFormValues) => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (values.newPassword !== values.confirmPassword) {
      setPasswordError('Password-et e rinj nuk perputhen.');
      return;
    }

    if (values.currentPassword === values.newPassword) {
      setPasswordError('Password-i i ri duhet te jete ndryshe nga password-i aktual.');
      return;
    }

    setPasswordLoading(true);
    const { error } = await changePassword(values.currentPassword, values.newPassword);
    setPasswordLoading(false);

    if (error) {
      setPasswordError(error);
      return;
    }

    reset();
    setPasswordSuccess('Password-i u ndryshua me sukses.');
    showToast('Password-i u ndryshua me sukses.', 'success');
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Profili</h1>
        <p className="muted">Llogaria, backup dhe cilësimet e hyrjes.</p>
      </div>

      <div className="panel profile-panel">
        {hasSupabaseConfig && user ? (
          <>
            <p><strong>Email:</strong> {user.email}</p>
            <p className="muted">ID: {user.id}</p>
            <p className="muted">
              Hyrja e fundit:{' '}
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('sq-AL') : '-'}
            </p>

            <form className="profile-password-form" onSubmit={handleSubmit(handlePasswordChange)}>
              <h2>Ndrysho password-in</h2>
              <label>
                Password-i aktual
                <input
                  type="password"
                  autoComplete="current-password"
                  {...register('currentPassword', { required: true })}
                  placeholder="********"
                />
              </label>
              <label>
                Password-i i ri
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register('newPassword', { required: true, minLength: 6 })}
                  placeholder="********"
                />
              </label>
              <label>
                Perserit password-in e ri
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmPassword', { required: true, minLength: 6 })}
                  placeholder="********"
                />
              </label>
              {passwordError && <p className="auth-error" role="alert">{passwordError}</p>}
              {passwordSuccess && <p className="auth-success" role="status">{passwordSuccess}</p>}
              <button type="submit" className="primary-button" disabled={passwordLoading}>
                {passwordLoading ? 'Duke ndryshuar...' : 'Ndrysho password-in'}
              </button>
            </form>

            <div className="profile-actions">
              <button type="button" className="primary-button" onClick={handleBackup}>
                Shkarko backup (JSON)
              </button>
              <button type="button" className="card" onClick={handleSignOut}>
                Dil nga llogaria
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Auth nuk është aktiv — konfiguro Supabase ose hyr në /login.</p>
        )}
      </div>
    </Shell>
  );
}
