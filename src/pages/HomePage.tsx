import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Database, FileUp, WalletCards, TrendingUp, PieChart, ReceiptText } from 'lucide-react';
import { Shell } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { InsightsCharts } from '../components/InsightsCharts';
import { hasSupabaseConfig } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { fetchCompletedProjects } from '../services/projects';
import { fetchDashboardStats } from '../services/stats';
import { fetchProjectSummaries, fetchCategorySummaries, fetchTotalSystemValue } from '../services/insights';
import { ensureDefaultCategories } from '../services/categories';
import { PROJECT_STATUSES } from '../constants/projectStatus';
import type { DbProject, ProjectSummary, CategorySummary } from '../types/database';

function greetingForHour(hour: number): string {
  if (hour < 11) return 'Mirëmëngjes';
  if (hour < 18) return 'Mirëdita';
  return 'Mirëmbrëma';
}

export function HomePage() {
  const [stats, setStats] = useState({ projects: 0, categories: 0, items: 0 });
  const [references, setReferences] = useState<DbProject[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [allProjects, setAllProjects] = useState<DbProject[]>([]);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
    fetchCompletedProjects().then(setReferences);
    fetchTotalSystemValue().then(setTotalValue);

    (async () => {
      if (!supabase) return;
      const [{ data: projects }, categories] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        ensureDefaultCategories(),
      ]);
      setAllProjects(projects || []);
      setProjectSummaries(await fetchProjectSummaries(projects || []));
      setCategorySummaries(await fetchCategorySummaries(categories));
    })();
  }, []);

  const today = useMemo(
    () => new Date().toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long' }),
    []
  );
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>(PROJECT_STATUSES.map((s) => [s.value, 0]));
    allProjects.forEach((project) => {
      const key = (project.status || 'draft') as string;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return PROJECT_STATUSES.map((s) => ({ ...s, count: counts.get(s.value) || 0 }));
  }, [allProjects]);
  const inProgressProjects = allProjects
    .filter((project) => (project.status || 'draft') === 'in_progress')
    .map((project) => project.name)
    .slice(0, 6);

  return (
    <Shell>
      <section className="hero card home-hero">
        <div className="home-hero-tickstrip" aria-hidden="true" />
        <div className="home-hero-top">
          <div>
            <div className="eyebrow accent">{today}</div>
            <h1>{greeting}.</h1>
            <p className="hero-copy">Ja gjendja e sotme e paramasave, projekteve dhe ofertave.</p>
          </div>
        </div>

        <div className="home-stat-strip">
          <div className="home-stat">
            <span className="home-stat-value">{stats.projects}</span>
            <span className="home-stat-label">projekte</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">{stats.categories}</span>
            <span className="home-stat-label">kategori</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">{stats.items}</span>
            <span className="home-stat-label">pozicione</span>
          </div>
          <div className="home-stat home-stat-highlight">
            <span className="home-stat-value">{totalValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</span>
            <span className="home-stat-label">vlera totale</span>
          </div>
        </div>
      </section>

      <section className="cards-grid">
        <NavLink className="big-card card" to="/register">
          <div className="card-icon"><WalletCards size={22} /></div>
          <h2>Regjistro</h2>
          <p>Llogarit dhe ruaj një pozicion me kosto të detajuara.</p>
        </NavLink>
        <NavLink className="big-card card" to="/fature">
          <div className="card-icon"><ReceiptText size={22} /></div>
          <h2>Krijo Fature</h2>
          <p>Ngarko shabllonin e faturës dhe plotëso fushat që ndryshojnë.</p>
        </NavLink>
        <NavLink className="big-card card" to="/import">
          <div className="card-icon"><FileUp size={22} /></div>
          <h2>Ngarko Excel</h2>
          <p>Ngarko paramasë dhe gjenero faqet e Librit Ndërtimor.</p>
        </NavLink>
        <NavLink className="big-card card" to="/data">
          <div className="card-icon"><Database size={22} /></div>
          <h2>Të dhënat</h2>
          <p>Krahaso projekte, kategori dhe historikun e çmimeve.</p>
        </NavLink>
      </section>

      <div className="home-columns">
        <div className="home-column-main">
          <section className="panel">
            <h3 className="panel-heading-accent"><PieChart size={17} className="panel-heading-icon" />Gjendja e projekteve</h3>
            <p className="muted">Pamje e shpejtë e projekteve draft, në proces dhe të përfunduara.</p>
            <div className="project-status-overview">
              {statusCounts.map((status) => (
                <div key={status.value} className={`project-status-card status-${status.value}`}>
                  <div className="project-status-head">
                    <StatusBadge status={status.value} />
                    <strong>{status.count}</strong>
                  </div>
                  <div className="project-status-description">{status.label}</div>
                  <div className="project-status-mini-bar" aria-hidden="true">
                    <span className={`project-status-mini-fill status-${status.value}`} style={{ width: `${Math.max(12, status.count > 0 ? 100 : 12)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="project-name-list-wrap">
              <div className="project-name-list-title">Në proces</div>
              <div className="project-name-list">
                {inProgressProjects.length > 0 ? (
                  inProgressProjects.map((name) => <div key={name} className="project-name-item">{name}</div>)
                ) : (
                  <div className="muted project-name-item">S'ka projekte në proces.</div>
                )}
              </div>
            </div>
          </section>

          {(projectSummaries.length > 0 || categorySummaries.length > 0) && (
            <section className="panel">
              <h3 className="panel-heading-accent"><TrendingUp size={17} className="panel-heading-icon" />Statistika</h3>
              <p className="muted">Vlera sipas projektit dhe shpërndarja e pozicioneve sipas kategorisë.</p>
              <InsightsCharts projectSummaries={projectSummaries} categorySummaries={categorySummaries} />
            </section>
          )}
        </div>

        <aside className="home-column-side">
          {references.length > 0 && (
            <section className="panel">
              <h3 className="panel-heading-accent">Projekte referencë</h3>
              <p className="muted">Ofertat e mëparshme, si bazë për vlerësime të reja.</p>
              <div className="reference-list">
                {references.slice(0, 6).map((project) => (
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
        </aside>
      </div>

      <div className="home-footer-status">
        <span className={`home-supabase-dot ${hasSupabaseConfig ? 'is-connected' : ''}`} />
        Supabase: {hasSupabaseConfig ? 'lidhur me sukses' : 'pa credential-a ende'}
      </div>
    </Shell>
  );
}
