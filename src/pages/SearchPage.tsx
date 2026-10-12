import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { BarChart3, FolderKanban, Layers3, Search, WalletCards } from 'lucide-react';
import { Shell } from '../components/Shell';
import { searchPositions } from '../services/search';
import type { SearchResultItem } from '../types/database';

type SearchForm = { query: string };

export function SearchPage() {
  const { register, watch } = useForm<SearchForm>({ defaultValues: { query: '' } });
  const query = watch('query');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const resultSummary = useMemo(() => ({
    projects: new Set(results.map((item) => item.project_id)).size,
    categories: new Set(results.map((item) => item.category_id).filter(Boolean)).size,
    total: results.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0),
  }), [results]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setResults(await searchPositions(trimmed));
      setLoading(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <Shell>
      <section className="search-intro-panel">
        <div className="search-intro-copy">
          <span className="search-kicker"><Search size={15} /> Kërkim në të dhëna</span>
          <h1>Gjej pozicionin e duhur më shpejt.</h1>
          <p className="muted">Kërko në përshkrime, numra pozicionesh, projekte dhe kategori nga një vend i vetëm.</p>
        </div>
        <div className="search-intro-icon" aria-hidden="true"><BarChart3 size={30} /></div>
      </section>

      <div className="page-header search-page-heading">
        <h1>Kërko</h1>
        <p className="muted">Kërko në përshkrim, numër pozicioni ose emër projekti (min. 2 karaktere).</p>
      </div>

      <div className="panel search-panel">
        <div className="search-panel-head">
          <strong>Kërkim global</strong>
          <span className="muted">{query.trim().length >= 2 ? `${results.length} rezultate` : 'Gati për kërkim'}</span>
        </div>
        <label className="search-panel-field">
          <input {...register('query')} placeholder="Kërko projekt, pozicion, referencë..." aria-label="Kërko" />
        </label>
      </div>

      {query.trim().length < 2 && (
        <div className="search-guide-grid">
          <div className="search-guide-card"><FolderKanban size={19} /><strong>Projekte</strong><span>Gjej pozicione edhe duke kërkuar emrin e projektit.</span></div>
          <div className="search-guide-card"><Layers3 size={19} /><strong>Pozicione & kategori</strong><span>Përdor përshkrimin ose numrin e pozicionit për rezultat të saktë.</span></div>
          <div className="search-guide-card"><WalletCards size={19} /><strong>Vlera</strong><span>Shiko totalin financiar të rezultateve të gjetura.</span></div>
        </div>
      )}

      {loading && <p className="muted search-status">Duke kërkuar...</p>}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="muted search-status">Nuk u gjet asnjë rezultat.</p>
      )}

      {results.length > 0 && (
        <div className="panel panel-top-gap">
          <div className="search-result-summary">
            <div><span>Rezultate</span><strong>{results.length}</strong></div>
            <div><span>Projekte</span><strong>{resultSummary.projects}</strong></div>
            <div><span>Kategori</span><strong>{resultSummary.categories}</strong></div>
            <div><span>Vlerë totale</span><strong>{resultSummary.total.toLocaleString('sq-AL', { maximumFractionDigits: 2 })} €</strong></div>
          </div>
          <h3 className="panel-title">Pozicionet e gjetura</h3>
          <div className="import-table-container">
            <table className="import-table">
              <thead>
                <tr className="import-table-head-row">
                  <th className="import-table-cell">Projekti</th>
                  <th className="import-table-cell">Kategoria</th>
                  <th className="import-table-cell">Nr</th>
                  <th>Përshkrimi</th>
                  <th>Totali</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id} className="import-table-body-row">
                    <td className="import-table-cell">{item.projects?.name || '-'}</td>
                    <td className="import-table-cell">{item.categories?.name || '-'}</td>
                    <td className="import-table-cell">{item.position_number || '-'}</td>
                    <td>{item.description}</td>
                    <td className="col-bold">{Number(item.total_price).toFixed(2)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
