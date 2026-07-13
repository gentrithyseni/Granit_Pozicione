import { useEffect, useMemo, useState } from 'react';
import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme, VictoryContainer, VictoryBar, VictoryScatter, VictoryLabel } from 'victory';
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
    date: new Date(point.recordedAt).toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit' }),
  }));

  const topProfitProjects = [...profitSummary].sort((a, b) => b.profitPercentAchieved - a.profitPercentAchieved).slice(0, 8);

  // Nëse një projekt ka fitim % jashtëzakonisht të lartë (rast i rrallë/ekstrem), e kufizon
  // shkallën e grafikut që të mos i "shtypë" në pafundësi shiritat e tjerë — vlera e saktë
  // mbetet gjithmonë e dukshme te etiketa dhe te tabela poshtë, thjesht shiriti pritet vizualisht.
  const { domainMax, hasOutlier } = useMemo(() => {
    const values = topProfitProjects.map((p) => p.profitPercentAchieved).filter((v) => Number.isFinite(v));
    if (values.length === 0) return { domainMax: 100, hasOutlier: false };
    const sorted = [...values].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1];
    const secondMax = sorted.length > 1 ? sorted[sorted.length - 2] : max;
    if (secondMax > 0 && max > secondMax * 2.5) {
      return { domainMax: Math.ceil(secondMax * 1.4), hasOutlier: true };
    }
    return { domainMax: Math.ceil(Math.max(max, 10) * 1.15), hasOutlier: false };
  }, [topProfitProjects]);

  return (
    <div className="panel panel-top-gap">
      <h3 className="panel-heading-accent">Analiza e çmimeve</h3>
      <p className="muted">Ndjek si ndryshon çmimi i një kategorie me kohë, dhe fitimin e planifikuar (çmimi i ofertuar kundrejt kostos) sipas projektit.</p>

      <div className="price-history-grid">
        <div className="price-history-chart-box">
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
            <VictoryChart theme={VictoryTheme.material} width={270} height={240} padding={{ top: 30, bottom: 40, left: 55, right: 20 }} containerComponent={<VictoryContainer responsive={false} />}>
              <VictoryAxis
                tickValues={chartData.map((d) => d.x)}
                tickFormat={(t: number) => chartData[t - 1]?.date || ''}
                style={{ tickLabels: { fontSize: 10, angle: -20, textAnchor: 'end' } }}
              />
              <VictoryAxis dependentAxis tickFormat={(t) => `${t}€`} style={{ tickLabels: { fontSize: 11 } }} />
              <VictoryLine data={chartData} style={{ data: { stroke: 'var(--primary, #6366f1)', strokeWidth: 2.5 } }} />
              <VictoryScatter
                data={chartData}
                size={4}
                style={{ data: { fill: 'var(--primary, #6366f1)' } }}
                labels={({ datum }: { datum: { y: number } }) => `${datum.y.toFixed(0)}€`}
                labelComponent={<VictoryLabel dy={-12} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--primary, #6366f1)' }} />}
              />
            </VictoryChart>
          )}
        </div>

        <div className="price-history-chart-box">
          <h4 className="price-history-subheading">Fitimi i planifikuar sipas projektit</h4>
          {topProfitProjects.length === 0 && <p className="muted field-hint">Ende s'ka të dhëna të mjaftueshme (regjistro pozicione me kosto materiali/pune).</p>}
          {topProfitProjects.length > 0 && (
            <>
              <VictoryChart
                theme={VictoryTheme.material}
                width={270}
                height={260}
                domainPadding={20}
                domain={{ y: [0, domainMax] }}
                padding={{ top: 20, bottom: 20, left: 55, right: 20 }}
                containerComponent={<VictoryContainer responsive={false} />}
              >
                <VictoryAxis tickFormat={() => ''} />
                <VictoryAxis dependentAxis tickFormat={(t) => `${t}%`} style={{ tickLabels: { fontSize: 11 } }} />
                <VictoryBar
                  data={topProfitProjects.map((p) => ({ x: p.projectName, y: Math.min(p.profitPercentAchieved, domainMax) }))}
                  style={{ data: { fill: 'var(--primary, #6366f1)' } }}
                  labels={({ datum, index }: { datum: { x: string; y: number }; index: number }) =>
                    `${topProfitProjects[Number(index)]?.profitPercentAchieved ?? datum.y}%`
                  }
                  labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 10, fontWeight: 700 }} />}
                />
              </VictoryChart>
              {hasOutlier && (
                <p className="muted field-hint">
                  ⚠ Një projekt ka fitim shumë mbi normalen — shiriti është prerë vizualisht që të mos i "fshehë" të tjerët; vlera e saktë shihet te etiketa dhe tabela poshtë.
                </p>
              )}
            </>
          )}
          <div className="price-history-table">
            {topProfitProjects.map((p) => (
              <div key={p.projectId} className="price-history-row-group">
                <div className="price-history-row">
                  <span>{p.projectName}</span>
                  <span className="muted">kosto (plan) {p.plannedCost}€ → ofertë {p.plannedTotal}€</span>
                  <strong>{p.profitPercentAchieved}%</strong>
                </div>
                {p.actualCost != null && (
                  <div className="price-history-row price-history-row-real">
                    <span className="muted">↳ reale: kosto {p.actualCost}€</span>
                    <span className={p.estimateErrorPercent != null && p.estimateErrorPercent < 0 ? 'diff-up' : 'diff-down'}>
                      vlerësimi ishte {p.estimateErrorPercent}% {p.estimateErrorPercent != null && p.estimateErrorPercent < 0 ? 'nën' : 'mbi'} realitetin
                    </span>
                    <strong>{p.realProfitPercent}% fitim real</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}