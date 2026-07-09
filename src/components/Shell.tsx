import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { MoonStar, SunMedium } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function Shell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-shell">
      <aside className="sidebar card">
        <div>
          <div className="eyebrow accent"> Granit </div>
          <div className="topbar-title"> Admin panel </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>
            <span className="sidebar-nav-icon">🏠</span>
            <span className="sidebar-nav-text"> Faqja Kryesore </span>
          </NavLink>
          <NavLink to="/register">
            <span className="sidebar-nav-icon">📝</span>
            <span className="sidebar-nav-text"> Regjistro </span>
          </NavLink>
          <NavLink to="/import">
            <span className="sidebar-nav-icon">📊</span>
            <span className="sidebar-nav-text"> Krijo Libër Ndërtimor </span>
          </NavLink>
          <NavLink to="/data">
            <span className="sidebar-nav-icon">💾</span>
            <span className="sidebar-nav-text"> Të Dhënat </span>
          </NavLink>
          <NavLink to="/search">
            <span className="sidebar-nav-icon">🔍</span>
            <span className="sidebar-nav-text"> Kërko </span>
          </NavLink>
          <NavLink to="/profile">
            <span className="sidebar-nav-icon">👤</span>
            <span className="sidebar-nav-text"> Profili </span>
          </NavLink>
        </nav>
        <button type="button" className="card theme-toggle-btn" onClick={toggleTheme} aria-label="Ndërro temën">
          {theme === 'light' ? <MoonStar size={18} /> : <SunMedium size={18} />} {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
