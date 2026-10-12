import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Info, LogOut, MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar card">
        <div>
          <NavLink to="/" end>
            <span className="sidebar-brand-frame">
              <img className="sidebar-brand-mark" src="/branding/megrant-logo.png" alt="Megrant ING" />
            </span>
          <div className="eyebrow accent"> Sistemi Administrativ </div>
          <div className="topbar-title"> Megrant ING </div> 
          </NavLink>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            <span className="sidebar-nav-icon" aria-hidden="true">🏠</span>
            <span className="sidebar-nav-text"> Faqja Kryesore </span>
          </NavLink>
          <NavLink to="/register">
            <span className="sidebar-nav-icon" aria-hidden="true">📝</span>
            <span className="sidebar-nav-text"> Regjistro </span>
          </NavLink>
          <NavLink to="/fature">
            <span className="sidebar-nav-icon" aria-hidden="true">🧾</span>
            <span className="sidebar-nav-text"> Krijo Fature </span>
          </NavLink>
          <NavLink to="/import">
            <span className="sidebar-nav-icon" aria-hidden="true">📊</span>
            <span className="sidebar-nav-text"> Krijo Libër Ndërtimor </span>
          </NavLink>
          <NavLink to="/data">
            <span className="sidebar-nav-icon" aria-hidden="true">💾</span>
            <span className="sidebar-nav-text"> Të Dhënat </span>
          </NavLink>
          <NavLink to="/search">
            <span className="sidebar-nav-icon" aria-hidden="true">🔍</span>
            <span className="sidebar-nav-text"> Kërko </span>
          </NavLink>
          <NavLink to="/profile">
            <span className="sidebar-nav-icon" aria-hidden="true">👤</span>
            <span className="sidebar-nav-text"> Profili </span>
          </NavLink>
          <NavLink to="/about-us">
            <span className="sidebar-nav-icon"><Info size={16} /></span>
            <span className="sidebar-nav-text"> Rreth Nesh </span>
          </NavLink>
        </nav>
        <div className="sidebar-footer-actions">
          <button type="button" className="card theme-toggle-btn sidebar-theme-toggle" onClick={toggleTheme} aria-label="Ndërro temën">
            {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />} {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="sidebar-logout-btn" onClick={handleSignOut}>
            <LogOut size={16} /> Dil nga llogaria
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
