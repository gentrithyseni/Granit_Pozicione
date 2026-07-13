import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryTheme, VictoryContainer, VictoryArea, VictoryScatter, VictoryLabel } from 'victory';
import type { MonthlyRevenuePoint } from '../services/insights';

type Props = {
  points: MonthlyRevenuePoint[];
};

/** Trend i vlerës totale të ofertuar (jo fitimi) sipas muajit — përgjigje e drejtpërdrejtë
 * ndaj pyetjes "a po rritet biznesi". Rritje e qëndrueshme e vijës = më shumë vlerë ofertash
 * me kohë; rënie = më pak projekte/ofertash regjistruar në atë periudhë. */
export function RevenueTrendChart({ points }: Props) {
  if (points.length < 2) {
    return (
      <p className="muted field-hint">
        Duhen të dhëna nga të paktën 2 muaj të ndryshëm për të parë një trend (tani ka {points.length}).
      </p>
    );
  }

  const chartData = points.map((point, index) => ({ x: index + 1, y: point.total }));
  const volumeData = points.map((point, index) => ({ x: index + 1, y: point.count }));

  const first = points[0].total;
  const last = points[points.length - 1].total;
  const growthPercent = first > 0 ? Math.round(((last - first) / first) * 100) : null;
  const totalValue = points.reduce((sum, point) => sum + point.total, 0);
  const totalItems = points.reduce((sum, point) => sum + point.count, 0);
  const bestMonth = points.reduce((best, point) => (point.total > best.total ? point : best), points[0]);
  const averageMonthlyValue = totalValue / points.length;
  const averageItemValue = totalItems > 0 ? totalValue / totalItems : 0;

  return (
    <div>
      <div className="insight-metric-grid">
        <div className="insight-metric">
          <span className="muted">Muaji me i forte</span>
          <strong>{bestMonth.label}</strong>
          <small>{bestMonth.total.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</small>
        </div>
        <div className="insight-metric">
          <span className="muted">Mesatarja mujore</span>
          <strong>{averageMonthlyValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
          <small>{points.length} muaj me te dhena</small>
        </div>
        <div className="insight-metric">
          <span className="muted">Mesatarja per pozicion</span>
          <strong>{averageItemValue.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€</strong>
          <small>{totalItems} pozicione</small>
        </div>
      </div>

      <div className="price-history-chart-box">
        <VictoryChart theme={VictoryTheme.material} width={640} height={240} padding={{ top: 30, bottom: 45, left: 60, right: 20 }} containerComponent={<VictoryContainer responsive={false} />}>
          <VictoryAxis
            tickValues={chartData.map((d) => d.x)}
            tickFormat={(t: number) => points[t - 1]?.label || ''}
            style={{ tickLabels: { fontSize: 11, angle: -20, textAnchor: 'end' } }}
          />
          <VictoryAxis dependentAxis tickFormat={(t) => `${(t / 1000).toFixed(0)}k€`} style={{ tickLabels: { fontSize: 11 } }} />
          <VictoryArea data={chartData} style={{ data: { fill: 'var(--primary-soft)', stroke: 'none' } }} />
          <VictoryLine data={chartData} style={{ data: { stroke: 'var(--primary, #6366f1)', strokeWidth: 2.5 } }} />
          <VictoryScatter
            data={chartData}
            size={4}
            style={{ data: { fill: 'var(--primary, #6366f1)' } }}
            labels={({ datum }: { datum: { y: number } }) => `${(datum.y / 1000).toFixed(1)}k€`}
            labelComponent={<VictoryLabel dy={-12} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--primary, #6366f1)' }} />}
          />
        </VictoryChart>
      </div>

      <div className="trend-secondary-chart">
        <h4>Volumi i pozicioneve sipas muajit</h4>
        <p className="muted chart-subtitle">Tregon nese rritja vjen nga me shume pozicione apo nga vlera me te larta per pozicion.</p>
        <div className="price-history-chart-box">
          <VictoryChart
            theme={VictoryTheme.material}
            width={640}
            height={210}
            domainPadding={{ x: 18 }}
            padding={{ top: 25, bottom: 45, left: 52, right: 20 }}
            containerComponent={<VictoryContainer responsive={false} />}
          >
            <VictoryAxis
              tickValues={volumeData.map((d) => d.x)}
              tickFormat={(t: number) => points[t - 1]?.label || ''}
              style={{ tickLabels: { fontSize: 11, angle: -20, textAnchor: 'end' } }}
            />
            <VictoryAxis dependentAxis tickFormat={(t) => `${t}`} style={{ tickLabels: { fontSize: 11 } }} />
            <VictoryBar
              data={volumeData}
              style={{ data: { fill: '#3b82f6', width: 18 } }}
              labels={({ datum }: { datum: { y: number } }) => `${datum.y}`}
              labelComponent={<VictoryLabel dy={-8} style={{ fontSize: 10, fontWeight: 700, fill: '#3b82f6' }} />}
            />
          </VictoryChart>
        </div>
      </div>

      {growthPercent !== null && (
        <p className="muted field-hint">
          Nga {points[0].label} deri {points[points.length - 1].label}:{' '}
          <strong className={growthPercent >= 0 ? 'diff-down' : 'diff-up'}>
            {growthPercent >= 0 ? '+' : ''}
            {growthPercent}%
          </strong>{' '}
          në vlerë ofertash.
        </p>
      )}
    </div>
  );
}
