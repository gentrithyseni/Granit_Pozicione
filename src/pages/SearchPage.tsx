import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Shell } from '../components/Shell';
import { searchPositions } from '../services/search';
import type { SearchResultItem } from '../types/database';

type SearchForm = { query: string };

export function SearchPage() {
  const { register, watch } = useForm<SearchForm>({ defaultValues: { query: '' } });
  const query = watch('query');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);

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
      <div className="page-header">
        <h1>Kërko</h1>
        <p className="muted">Kërko në përshkrim, numër pozicioni ose emër projekti (min. 2 karaktere).</p>
      </div>

      <div className="panel">
        <label>
          Kërkim global
          <input {...register('query')} placeholder="Kërko projekt, pozicion, referencë..." aria-label="Kërko" />
        </label>
      </div>

      {loading && <p className="muted search-status">Duke kërkuar...</p>}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="muted search-status">Nuk u gjet asnjë rezultat.</p>
      )}

      {results.length > 0 && (
        <div className="panel panel-top-gap">
          <h3 className="panel-title">{results.length} rezultate</h3>
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
