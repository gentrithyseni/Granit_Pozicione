import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Database, FileUp, WalletCards } from 'lucide-react';
import { Shell } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { hasSupabaseConfig } from '../lib/supabase';
import { fetchCompletedProjects } from '../services/projects';
import { fetchDashboardStats } from '../services/stats';
import type { DbProject } from '../types/database';

export function HomePage() {
  const [stats, setStats] = useState({ projects: 0, categories: 0, items: 0 });
  const [references, setReferences] = useState<DbProject[]>([]);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
    fetchCompletedProjects().then(setReferences);
  }, []);

  return (
    <Shell>
      <section className="hero card">
        <div>
          <div className="eyebrow accent">Graniti</div>
          <h1>Graniti Admin Web</h1>
          <p className="hero-copy">Dashboard për paramasa, projekte dhe llogaritje me Supabase.</p>
        </div>
        <div className="hero-stats">
          <div><strong>{stats.projects}</strong><span>projekte</span></div>
          <div><strong>{stats.categories}</strong><span>kategori</span></div>
          <div><strong>{stats.items}</strong><span>pozicione</span></div>
        </div>
      </section>

      <section className="cards-grid">
        <NavLink className="big-card card" to="/register">
          <div className="card-icon"><WalletCards size={24} /></div>
          <h2>Me regjistru</h2>
          <p>Regjistro pozicione me llogaritje të detajuara.</p>
        </NavLink>
        <NavLink className="big-card card" to="/import">
          <div className="card-icon"><FileUp size={24} /></div>
          <h2>Ngarko Excel</h2>
          <p>Ngarko paramasë, analizo dhe aprovo rreshtat.</p>
        </NavLink>
        <NavLink className="big-card card" to="/data">
          <div className="card-icon"><Database size={24} /></div>
          <h2>Të dhënat</h2>
          <p>Shiko projektet, kategoritë dhe rreshtat e ruajtur.</p>
        </NavLink>
      </section>

      {references.length > 0 && (
        <section className="panel">
          <h3 className="panel-heading-accent">Projekte referencë (të përfunduara)</h3>
          <p className="muted">Përdor ofertat e mëparshme si bazë për vlerësime të reja.</p>
          <div className="reference-list">
            {references.map((project) => (
              <div key={project.id} className="reference-item">
                <div>
                  <strong>{project.name}</strong>
                  {project.client && <span className="project-item-meta"> — {project.client}</span>}
                </div>
                <StatusBadge status={project.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="notice card">
        <strong>Supabase status:</strong> {hasSupabaseConfig ? 'Lidhur me sukses' : 'pa credential-a ende'}
      </section>
    </Shell>
  );
}
