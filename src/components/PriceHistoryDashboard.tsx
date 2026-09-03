import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign } from 'lucide-react';
import type { DbCategory } from '../types/database';
import { fetchPriceTrend, fetchProfitSummaryByProject, type PriceTrendPoint, type ProfitSummary } from '../services/priceHistory';

type Props = {
  categories: DbCategory[];
};

/** Dashboard analize: (1) si ndryshon çmimi i një kategorie me kohë, (2) fitimi i planifikuar
 * (çmimi i ofertuar minus koston e regjistruar) sipas projektit. Të dhënat vijnë nga
 * price_history (snapshot çdo herë që regjistrohet/redaktohet një pozicion) dhe item_expenses. */
export function PriceHistoryDashboard({ categories }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [trend, setTrend] = useState<PriceTrendPoint[]>([]);
  const [profitSummary, setProfitSummary] = useState<ProfitSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfitSummaryByProject().then(setProfitSummary);
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) {
      setTrend([]);
      return;
    }
    setLoading(true);
    fetchPriceTrend(selectedCategoryId)
      .then(setTrend)
      .finally(() => setLoading(false));
  }, [selectedCategoryId]);

  const topProfitProjects = [...profitSummary].sort((a, b) => b.profitPercentAchieved - a.profitPercentAchieved).slice(0, 8);
  const selectedCategoryName = categories.find((category) => category.id === selectedCategoryId)?.name || '';
  const trendStats = useMemo(() => {
    if (trend.length === 0) return null;
    const first = trend[0].unitPrice;
    const latest = trend[trend.length - 1].unitPrice;
    const min = Math.min(...trend.map((point) => point.unitPrice));
    const max = Math.max(...trend.map((point) => point.unitPrice));
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;
    return { first, latest, min, max, change };
  }, [trend]);
  const maxProfit = Math.max(...topProfitProjects.map((project) => Math.abs(project.profitPercentAchieved)), 1);

  return (
    <div className="panel panel-top-gap">
      <div className="price-history-heading">
        <div>
          <h3 className="panel-heading-accent"><BarChart3 size={17} className="panel-heading-icon" /> Analiza e çmimeve</h3>
          <p className="muted">Krahaso çmimin e pozicioneve me kohë dhe shiko cilat projekte kanë rezultat më të mirë.</p>
        </div>
        <span className="price-history-purpose">Për vendimmarrje</span>
      </div>

      <div className="price-history-grid">
        <div className="price-history-chart-box">
          <div className="price-history-box-head">
            <div><span className="price-history-kicker">Historiku</span><h4 className="price-history-subheading">Ndryshimi i çmimit</h4></div>
            <label className="price-history-select-label">Kategoria
              <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                <option value="">-- Zgjidh kategorinë --</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
          </div>

          {!selectedCategoryId && <p className="muted field-hint">Zgjidh një kategori për të parë trendin e çmimit.</p>}
          {selectedCategoryId && loading && <p className="muted field-hint">Duke ngarkuar...</p>}
          {selectedCategoryId && !loading && trend.length === 0 && (
            <p className="muted field-hint">Ende s'ka histori çmimesh për këtë kategori (regjistro ose redakto një pozicion për të filluar).</p>
          )}
          {selectedCategoryId && !loading && trendStats && (
            <>
              <div className="price-history-kpis">
                <div><span>Çmimi i fundit</span><strong>{trendStats.latest.toFixed(2)}€</strong><small>{selectedCategoryName}</small></div>
                <div><span>Ndryshimi</span><strong className={trendStats.change >= 0 ? 'diff-up' : 'diff-down'}>{trendStats.change >= 0 ? '+' : ''}{trendStats.change.toFixed(1)}%</strong><small>nga regjistrimi i parë</small></div>
                <div><span>Intervali</span><strong>{trendStats.min.toFixed(2)}€ - {trendStats.max.toFixed(2)}€</strong><small>{trend.length} regjistrime</small></div>
              </div>
              <div className="price-history-timeline">
                {trend.slice(-8).map((point, index, points) => {
                  const range = trendStats.max - trendStats.min || 1;
                  const width = 18 + ((point.unitPrice - trendStats.min) / range) * 82;
                  const isLatest = index === points.length - 1;
                  return <div className={`price-history-timeline-row ${isLatest ? 'latest' : ''}`} key={`${point.recordedAt}-${index}`}>
                    <span>{new Date(point.recordedAt).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit' })}</span>
                    <div className="price-history-track"><i style={{ width: `${width}%` }} /></div>
                    <strong>{point.unitPrice.toFixed(2)}€</strong>
                  </div>;
                })}
              </div>
            </>
          )}
        </div>

        <div className="price-history-chart-box">
          <div className="price-history-box-head">
            <div><span className="price-history-kicker">Krahasimi</span><h4 className="price-history-subheading">Rezultati sipas projektit</h4></div>
            <CircleDollarSign size={20} className="price-history-box-icon" />
          </div>
          {topProfitProjects.length === 0 && <p className="muted field-hint">Ende s'ka të dhëna të mjaftueshme (regjistro pozicione me kosto materiali/pune).</p>}
          {topProfitProjects.length > 0 && (
            <>
              <div className="profit-summary-strip"><div><span>Projektet</span><strong>{profitSummary.length}</strong></div><div><span>Më i larti</span><strong>{topProfitProjects[0].profitPercentAchieved}%</strong></div><div><span>Fitim real</span><strong>{topProfitProjects.filter((project) => project.realProfitPercent != null).length}</strong></div></div>
              <div className="price-history-table">
                {topProfitProjects.map((p) => {
                  const positive = p.profitPercentAchieved >= 0;
                  return <div key={p.projectId} className="price-history-row-group">
                    <div className="price-history-row">
                      <span className="price-history-project-name">{p.projectName}</span>
                      <div className="profit-bar-track"><i className={positive ? 'profit-bar-positive' : 'profit-bar-negative'} style={{ width: `${Math.min((Math.abs(p.profitPercentAchieved) / maxProfit) * 100, 100)}%` }} /></div>
                      <strong className={positive ? 'diff-up' : 'diff-down'}>{p.profitPercentAchieved}%</strong>
                    </div>
                    {p.actualCost != null && (
                      <div className="price-history-row price-history-row-real"><span className="muted">Kosto reale: {p.actualCost}€</span><span className="muted">Vlerësimi: {p.estimateErrorPercent}%</span><strong>{p.realProfitPercent}% real</strong></div>
                    )}
                  </div>;
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}