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
          <div className="eyebrow accent">Graniti</div>
          <div className="topbar-title">Admin panel</div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end>Ballina</NavLink>
          <NavLink to="/register">Regjistro</NavLink>
          <NavLink to="/import">Ngarko Excel</NavLink>
          <NavLink to="/data">Të dhënat</NavLink>
          <NavLink to="/search">Kërko</NavLink>
          <NavLink to="/profile">Profili</NavLink>
        </nav>
        <button type="button" className="card theme-toggle-btn" onClick={toggleTheme} aria-label="Ndërro temën">
          {theme === 'light' ? <MoonStar size={18} /> : <SunMedium size={18} />} {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
