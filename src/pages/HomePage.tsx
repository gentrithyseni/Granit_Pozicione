import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Database, FileUp, WalletCards, TrendingUp, PieChart, ReceiptText, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Shell } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { InsightsCharts } from '../components/InsightsCharts';
import { hasSupabaseConfig } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { fetchCompletedProjects } from '../services/projects';
import { fetchDashboardStats } from '../services/stats';
import { fetchProjectSummaries, fetchCategorySummaries, fetchTotalSystemValue, fetchTransportCityUsage, type CityUsageSummary } from '../services/insights';
import { ensureDefaultCategories } from '../services/categories';
import { fetchLibriExportRecords, type LibriExportRecord } from '../services/libriExports';
import { buildLibriNdertimorWorkbook, downloadWorkbookBuffer, planLibriExport } from '../lib/libriExport';
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
  const [cityUsage, setCityUsage] = useState<CityUsageSummary[]>([]);
  const [allProjects, setAllProjects] = useState<DbProject[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [recentParamasa, setRecentParamasa] = useState<LibriExportRecord | null>(null);
  const [recentActionId, setRecentActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
    fetchCompletedProjects().then(setReferences);
    fetchTotalSystemValue().then(setTotalValue);
    fetchLibriExportRecords().then((records) => setRecentParamasa(records[0] ?? null));

    (async () => {
      if (!supabase) return;
      const [{ data: projects }, categories] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        ensureDefaultCategories(),
      ]);
      setAllProjects(projects || []);
      setProjectSummaries(await fetchProjectSummaries(projects || []));
      setCategorySummaries(await fetchCategorySummaries(categories));
      setCityUsage(await fetchTransportCityUsage());
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
  const selectedProjects = useMemo(
    () =>
      selectedStatus
        ? allProjects
            .filter((project) => (project.status || 'draft') === selectedStatus)
            .slice(0, 8)
        : [],
    [allProjects, selectedStatus]
  );

  const selectedStatusLabel = useMemo(
    () => PROJECT_STATUSES.find((status) => status.value === selectedStatus)?.label ?? 'Projektet',
    [selectedStatus]
  );

  const recentPageCount = recentParamasa ? planLibriExport(recentParamasa.rows).length : 0;

  const handleDownloadRecent = async () => {
    if (!recentParamasa) return;
    setRecentActionId(recentParamasa.id);
    try {
      const buffer = await buildLibriNdertimorWorkbook(recentParamasa.rows, recentParamasa.meta);
      const safeName = (recentParamasa.fileName || 'Paramasa').replace(/\.[^/.]+$/, '').replace(/\s+/g, ' ').trim() || 'Paramasa';
      downloadWorkbookBuffer(buffer, `${safeName}-Libri-Ndertimor.xlsx`);
    } finally {
      setRecentActionId(null);
    }
  };

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
          <div className="home-hero-badge">
            <span className="muted">Vlera e sistemit</span>
            <strong>{totalValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })} €</strong>
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
        </div>
      </section>

      <section className="cards-grid">
        <NavLink className="big-card card" to="/register">
          <div className="card-icon"><WalletCards size={22} /></div>
          <div className="big-card-body">
            <h2>Regjistro</h2>
            <p>Llogarit dhe ruaj një pozicion me kosto të detajuara.</p>
          </div>
          <span className="big-card-go">Hape →</span>
        </NavLink>
        <NavLink className="big-card card" to="/fature">
          <div className="card-icon"><ReceiptText size={22} /></div>
          <div className="big-card-body">
            <h2>Krijo Fature</h2>
            <p>Ngarko shabllonin e faturës dhe plotëso fushat që ndryshojnë.</p>
          </div>
          <span className="big-card-go">Hape →</span>
        </NavLink>
        <NavLink className="big-card card" to="/import">
          <div className="card-icon"><FileUp size={22} /></div>
          <div className="big-card-body">
            <h2>Libri Ndërtimor</h2>
            <p>Ngarko paramasë dhe gjenero faqet e Librit Ndërtimor.</p>
          </div>
          <span className="big-card-go">Hape →</span>
        </NavLink>
        <NavLink className="big-card card" to="/data">
          <div className="card-icon"><Database size={22} /></div>
          <div className="big-card-body">
            <h2>Të dhënat</h2>
            <p>Krahaso projekte, kategori dhe historikun e çmimeve.</p>
          </div>
          <span className="big-card-go">Hape →</span>
        </NavLink>
      </section>

      {recentParamasa && (
        <section className="panel recent-paramasa-card">
          <div className="recent-paramasa-head">
            <div>
              <h3>Paramasa e fundit</h3>
              <p className="muted">{recentParamasa.fileName}</p>
            </div>
            <div className="recent-paramasa-badges">
              <span>{recentParamasa.positionsCount} pozicione</span>
              <span>{recentPageCount} faqe</span>
            </div>
          </div>
          <div className="recent-paramasa-actions">
            <button type="button" className="card" onClick={handleDownloadRecent} disabled={recentActionId === recentParamasa.id}>
              {recentActionId === recentParamasa.id ? 'Duke gjeneruar…' : 'Shkarko përsëri'}
            </button>
            <NavLink className="card" to="/import">Hape</NavLink>
          </div>
        </section>
      )}

      <div className="home-columns">
        <div className="home-column-main">
          <section className="panel">
            <h3 className="panel-heading-accent"><PieChart size={17} className="panel-heading-icon" />Gjendja e projekteve</h3>
            <p className="muted">Pamje e shpejtë e projekteve draft, në proces dhe të përfunduara.</p>
            <div className="project-status-overview">
              {statusCounts.map((status) => {
                const isSelected = selectedStatus === status.value;
                return (
                  <button
                    key={status.value}
                    type="button"
                    className={`project-status-card status-${status.value} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedStatus((current) => (current === status.value ? null : status.value))}
                    aria-pressed={isSelected}
                  >
                    <div className="project-status-head">
                      <StatusBadge status={status.value} />
                      <strong>{status.count}</strong>
                    </div>
                    <div className="project-status-description">{status.label}</div>
                    <div className="project-status-mini-bar" aria-hidden="true">
                      <span className={`project-status-mini-fill status-${status.value}`} style={{ width: `${Math.max(12, status.count > 0 ? 100 : 12)}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedStatus && (
              <section className="panel project-reference-panel">
                <h3 className="panel-heading-accent">
                  {selectedStatus === 'completed' ? 'Projekte të përfunduara' : `Projekte ${selectedStatusLabel.toLowerCase()}`}
                </h3>
                <p className="muted">
                  {selectedStatus === 'completed'
                    ? 'Projektet e fundit të përfunduara, si referencë për vlerësime të reja.'
                    : `Lista e projekteve ${selectedStatusLabel.toLowerCase()} në sistem.`}
                </p>

                {selectedStatus === 'completed' ? (
                  references.length > 0 ? (
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
                  ) : (
                    <div className="muted project-name-item">S'ka projekte të përfunduara.</div>
                  )
                ) : (
                  <div className="project-name-list-wrap">
                    <div className="project-name-list-title">{selectedStatusLabel}</div>
                    <div className="project-name-list">
                      {selectedProjects.length > 0 ? (
                       selectedProjects.map((project) => (
                        <div key={project.id} className="project-name-item">
                          <div>
                            <strong>{project.name}</strong>
                            {project.client && (
                              <span className="project-item-meta"> — {project.client}</span>
                            )}
                          </div>

                          <StatusBadge status={project.status} />
                        </div>
                      ))) : (
                        <div className="muted project-name-item">S'ka projekte {selectedStatusLabel.toLowerCase()}.</div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>

          {(projectSummaries.length > 0 || categorySummaries.length > 0) && (
            <section className="panel">
              <h3 className="panel-heading-accent"><TrendingUp size={17} className="panel-heading-icon" />Statistika</h3>
              <p className="muted">Vlera sipas projektit dhe shpërndarja e pozicioneve sipas kategorisë.</p>
              <InsightsCharts projectSummaries={projectSummaries} categorySummaries={categorySummaries} cityUsage={cityUsage} />
            </section>
          )}
        </div>

        <aside className="home-column-side" />
      </div>

      <section className="panel home-admin-section">
        <h3 className="panel-heading-accent">
          <Activity size={17} className="panel-heading-icon" />
          Përmbledhje e shpejtë
        </h3>
        <div className="admin-insights-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Exporti i fundit</span>
              <CheckCircle2 size={16} className="admin-stat-icon success" />
            </div>
            <div className="admin-stat-value">{recentParamasa ? 'Gati' : 'S\'ka'}</div>
            <p className="muted admin-stat-note">
              {recentParamasa ? `${recentPageCount} faqe në librin e fundit` : 'Nuk ka export të kryer'}
            </p>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Projektet aktive</span>
              <TrendingUp size={16} className="admin-stat-icon primary" />
            </div>
            <div className="admin-stat-value">{allProjects.filter((project) => (project.status || 'draft') === 'in_progress').length}</div>
            <p className="muted admin-stat-note">
              {allProjects.filter((project) => (project.status || 'draft') === 'in_progress').length > 0 ? 'në proces' : 'asnjë në proces'}
            </p>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-top">
              <span className="admin-stat-label">Pozicione të regjistruara</span>
              <CheckCircle2 size={16} className="admin-stat-icon success" />
            </div>
            <div className="admin-stat-value">{stats.items}</div>
            <p className="muted admin-stat-note">
              në total
            </p>
          </div>
        </div>
      </section>

      <div className="home-footer-status">
        <span className={`home-supabase-dot ${hasSupabaseConfig ? 'is-connected' : ''}`} />
        Supabase: {hasSupabaseConfig ? 'lidhur me sukses' : 'pa credential-a ende'}
      </div>
    </Shell>
  );
}
