import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Activity, ArrowUpRight, CheckCircle2, Clock3, DatabaseBackup, KeyRound, LogOut, ShieldCheck, Timer, UserCheck, UserX, Users } from 'lucide-react';
import { Shell } from '../components/Shell';
import { useToast } from '../context/ToastContext';
import { hasSupabaseConfig } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { exportAllDataJson } from '../services/projects';
import { fetchUserProfiles, updateUserApproval } from '../services/userManagement';
import type { DbProfile, UserApprovalStatus } from '../types/database';

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const approvalStatusLabels: Record<UserApprovalStatus, string> = {
  pending: 'Në pritje',
  approved: 'Aprovuar',
  rejected: 'Refuzuar',
  suspended: 'Pezulluar',
};

function formatApplicationDate(value?: string) {
  if (!value) return 'Ora e aplikimit nuk dihet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ora e aplikimit nuk dihet';
  const day = date.toLocaleDateString('sq-AL', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${time}`;
}

export function ProfilePage() {
  const { user, profile, isAdmin, changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast, showSavedToast } = useToast();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileActionId, setProfileActionId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<PasswordFormValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const reloadProfiles = async () => {
    setProfilesLoading(true);
    const result = await fetchUserProfiles();
    setProfiles(result.data);
    if (result.error) showToast(result.error, 'error');
    setProfilesLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void reloadProfiles();
  }, [isAdmin]);

  const profileStats = useMemo(
    () => ({
      total: profiles.length,
      pending: profiles.filter((profile) => profile.status === 'pending').length,
      approved: profiles.filter((profile) => profile.status === 'approved').length,
      rejected: profiles.filter((profile) => profile.status === 'rejected').length,
    }),
    [profiles]
  );

  const handleProfileStatus = async (profile: DbProfile, status: Extract<UserApprovalStatus, 'approved' | 'rejected' | 'suspended'>) => {
    const actionLabel = status === 'approved' ? 'aprovosh' : status === 'rejected' ? 'refuzosh' : 'pezullosh';
    if (!window.confirm(`A dëshiron ta ${actionLabel} përdoruesin ${profile.email}?`)) return;
    setProfileActionId(profile.id);
    const result = await updateUserApproval(profile.id, status);
    if (result.error) showToast(result.error, 'error');
    else {
      await reloadProfiles();
      showSavedToast(`Përdoruesi u ${status === 'approved' ? 'aprovua' : status === 'rejected' ? 'refuzua' : 'pezullua'}.`);
    }
    setProfileActionId(null);
  };

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
    showSavedToast('Password-i u ndryshua me sukses.');
  };

  return (
    <Shell>
      <div className="page-header">
        <h1>Profili</h1>
        <p className="muted">Llogaria, backup dhe cilësimet e hyrjes.</p>
      </div>

      <div className="profile-layout">
        <div className="panel profile-panel">
        {hasSupabaseConfig && user ? (
          <>
            <p><strong>Email:</strong> {user.email}</p>
            <p className="muted">ID: {user.id}</p>
            <p className="muted">
              Hyrja e fundit:{' '}
              {user.last_sign_in_at ? formatApplicationDate(user.last_sign_in_at) : '-'}
            </p>

            {isAdmin && (
              <section className="profile-user-admin-section">
                <div className="profile-user-admin-header">
                  <div>
                    <span className="profile-side-kicker">Administrimi</span>
                    <h2>Aplikimet për llogari</h2>
                    <p className="profile-admin-description">Kontrollo kërkesat dhe statusin e qasjes në sistem.</p>
                  </div>
                  <Users size={22} className="profile-admin-icon" />
                </div>
                <div className="profile-user-stats">
                  <div><strong>{profileStats.total}</strong><span><Users size={14} /> Total</span></div>
                  <div><strong>{profileStats.pending}</strong><span><Clock3 size={14} /> Në pritje</span></div>
                  <div><strong>{profileStats.approved}</strong><span><UserCheck size={14} /> Aprovuar</span></div>
                  <div><strong>{profileStats.rejected}</strong><span><UserX size={14} /> Refuzuar</span></div>
                </div>
                <div className="profile-user-list">
                  {profilesLoading ? (
                    <p className="muted">Duke ngarkuar aplikimet...</p>
                  ) : profiles.length === 0 ? (
                    <p className="muted">Nuk ka profile. Ekzekuto migration SQL në Supabase.</p>
                  ) : profiles.map((candidate) => (
                    <div key={candidate.id} className="profile-user-row">
                      <div className="profile-user-info">
                        <strong>{candidate.full_name || 'Pa emër'}</strong>
                        <span>{candidate.email}</span>
                        <small>{formatApplicationDate(candidate.created_at)}</small>
                      </div>
                      <span className={`profile-user-status status-${candidate.status}`}>
                        {approvalStatusLabels[candidate.status]}
                      </span>
                      <div className="profile-user-actions">
                        {candidate.status === 'pending' && (
                          <>
                            <button type="button" className="primary-button profile-user-action approve-action" onClick={() => handleProfileStatus(candidate, 'approved')} disabled={profileActionId === candidate.id}>Aprovo</button>
                            <button type="button" className="card profile-user-action reject-action" onClick={() => handleProfileStatus(candidate, 'rejected')} disabled={profileActionId === candidate.id}>Refuzo</button>
                          </>
                        )}
                        {candidate.status === 'approved' && candidate.id !== user?.id && (
                          <button type="button" className="card profile-user-action suspend-action" onClick={() => handleProfileStatus(candidate, 'suspended')} disabled={profileActionId === candidate.id}>Pezullo</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <form className="profile-password-form" onSubmit={handleSubmit(handlePasswordChange)}>
              <div className="profile-password-heading">
                <div>
                  <span className="profile-side-kicker">Siguria</span>
                  <h2>Ndrysho password-in</h2>
                </div>
                <KeyRound size={20} />
              </div>
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
              <button type="submit" className="primary-button profile-password-submit" disabled={passwordLoading}>
                {passwordLoading ? 'Duke ndryshuar...' : 'Ndrysho password-in'}
              </button>
            </form>

            <div className="profile-actions">
              <button type="button" className="primary-button profile-signout-primary" onClick={handleSignOut}>
                <LogOut size={16} /> Dil nga llogaria
              </button>
              <button type="button" className="card profile-backup-action" onClick={handleBackup}>
                <DatabaseBackup size={16} /> Shkarko backup (JSON)
              </button>
            </div>
          </>
        ) : (
          <p className="muted">Auth nuk është aktiv — konfiguro Supabase ose hyr në /login.</p>
        )}
        </div>

        <aside className="panel profile-side-panel">
          <div className="profile-side-icon"><ShieldCheck size={22} /></div>
          <div>
            <span className="profile-side-kicker">Siguria e llogarisë</span>
            <h2>Llogaria jote është aktive</h2>
            <p className="muted">Menaxho hyrjen, ruaj një kopje të të dhënave dhe mbaj kontrollin e projektit.</p>
          </div>
          <div className="profile-side-list">
            <div><CheckCircle2 size={17} /><span>Autentikimi me Supabase</span></div>
            <div><KeyRound size={17} /><span>Password i ndryshueshëm</span></div>
            <div><DatabaseBackup size={17} /><span>Backup JSON i shkarkueshëm</span></div>
          </div>
          <div className="profile-side-note">
            <strong>Backup i rregullt</strong>
            <span>Shkarko backup-in para ndryshimeve të mëdha në të dhëna.</span>
          </div>
          <div className="profile-account-summary">
            <div className="profile-account-summary-head"><span>Përmbledhje e llogarisë</span><Activity size={16} /></div>
            <div className="profile-account-summary-row"><span>Statusi</span><strong className="profile-account-active">{profile?.status === 'approved' ? 'Aktive' : 'Në pritje'}</strong></div>
            <div className="profile-account-summary-row"><span>Roli</span><strong>{isAdmin ? 'Administrator' : 'Përdorues'}</strong></div>
            <div className="profile-account-summary-row"><span>Timeout i sesionit</span><strong><Timer size={14} /> 60 min</strong></div>
          </div>
          <div className="profile-quick-links">
            <NavLink to="/about-us">Rreth Megrant ING <ArrowUpRight size={15} /></NavLink>
            <NavLink to="/data">Hap të dhënat <ArrowUpRight size={15} /></NavLink>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
