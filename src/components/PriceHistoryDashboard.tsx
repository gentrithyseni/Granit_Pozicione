import { useEffect, useState } from 'react';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme, VictoryContainer, VictoryBar, VictoryTooltip } from 'victory';
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

  const chartData = trend.map((point, index) => ({
    x: index + 1,
    y: point.unitPrice,
    label: `${point.unitPrice.toFixed(2)}€\n${new Date(point.recordedAt).toLocaleDateString('sq-AL')}`,
  }));

  const topProfitProjects = [...profitSummary].sort((a, b) => b.profitPercentAchieved - a.profitPercentAchieved).slice(0, 8);

  return (
    <div className="panel panel-top-gap">
      <h3 className="panel-heading-accent">Analiza e çmimeve</h3>
      <p className="muted">Ndjek si ndryshon çmimi i një kategorie me kohë, dhe fitimin e planifikuar (çmimi i ofertuar kundrejt kostos) sipas projektit.</p>

      <div className="price-history-grid">
        <div>
          <label>
            Kategoria
            <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
              <option value="">-- Zgjidh kategorinë --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          {!selectedCategoryId && <p className="muted field-hint">Zgjidh një kategori për të parë trendin e çmimit.</p>}
          {selectedCategoryId && loading && <p className="muted field-hint">Duke ngarkuar...</p>}
          {selectedCategoryId && !loading && trend.length === 0 && (
            <p className="muted field-hint">Ende s'ka histori çmimesh për këtë kategori (regjistro ose redakto një pozicion për të filluar).</p>
          )}
          {selectedCategoryId && !loading && trend.length > 0 && (
            <VictoryChart theme={VictoryTheme.material} height={220} containerComponent={<VictoryContainer responsive={true} />}>
              <VictoryAxis tickFormat={() => ''} label="Kronologjikisht →" style={{ axisLabel: { fontSize: 9, padding: 20 } }} />
              <VictoryAxis dependentAxis tickFormat={(t) => `${t}€`} style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryLine
                data={chartData}
                style={{ data: { stroke: 'var(--primary, #6366f1)', strokeWidth: 2 } }}
                labelComponent={<VictoryTooltip />}
              />
            </VictoryChart>
          )}
        </div>

        <div>
          <h4 className="price-history-subheading">Fitimi i planifikuar sipas projektit</h4>
          {topProfitProjects.length === 0 && <p className="muted field-hint">Ende s'ka të dhëna të mjaftueshme (regjistro pozicione me kosto materiali/pune).</p>}
          {topProfitProjects.length > 0 && (
            <VictoryChart theme={VictoryTheme.material} height={240} domainPadding={16} containerComponent={<VictoryContainer responsive={true} />}>
              <VictoryAxis tickFormat={() => ''} />
              <VictoryAxis dependentAxis tickFormat={(t) => `${t}%`} style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryBar
                data={topProfitProjects.map((p) => ({ x: p.projectName, y: p.profitPercentAchieved }))}
                style={{ data: { fill: 'var(--primary, #6366f1)' } }}
                labelComponent={<VictoryTooltip />}
                labels={({ datum }: { datum: { x: string; y: number } }) => `${datum.x}\n${datum.y}%`}
              />
            </VictoryChart>
          )}
          <div className="price-history-table">
            {topProfitProjects.map((p) => (
              <div key={p.projectId} className="price-history-row">
                <span>{p.projectName}</span>
                <span className="muted">kosto {p.plannedCost}€ → ofertë {p.plannedTotal}€</span>
                <strong>{p.profitPercentAchieved}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}