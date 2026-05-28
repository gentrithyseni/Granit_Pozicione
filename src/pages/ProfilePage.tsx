import { useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { exportAllDataJson } from '../services/projects';

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleBackup = async () => {
    const result = await exportAllDataJson();
    if (result.ok) showToast('Backup JSON u shkarkua.', 'success');
    else showToast(result.message || 'Gabim', 'error');
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
