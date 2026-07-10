import { VictoryAxis, VictoryChart, VictoryLine, VictoryTheme, VictoryContainer, VictoryTooltip, VictoryArea } from 'victory';
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

  const chartData = points.map((point, index) => ({
    x: index + 1,
    y: point.total,
    label: `${point.label}\n${point.total.toLocaleString('sq-AL', { maximumFractionDigits: 0 })}€`,
  }));

  const first = points[0].total;
  const last = points[points.length - 1].total;
  const growthPercent = first > 0 ? Math.round(((last - first) / first) * 100) : null;

  return (
    <div>
      <div className="price-history-chart-box">
        <VictoryChart theme={VictoryTheme.material} width={600} height={220} containerComponent={<VictoryContainer responsive={false} />}>
          <VictoryAxis
            tickValues={chartData.map((d) => d.x)}
            tickFormat={(t: number) => points[t - 1]?.label || ''}
            style={{ tickLabels: { fontSize: 8, angle: 0 } }}
          />
          <VictoryAxis dependentAxis tickFormat={(t) => `${(t / 1000).toFixed(0)}k€`} style={{ tickLabels: { fontSize: 9 } }} />
          <VictoryArea
            data={chartData}
            style={{ data: { fill: 'var(--primary-soft)', stroke: 'none' } }}
          />
          <VictoryLine
            data={chartData}
            style={{ data: { stroke: 'var(--primary, #6366f1)', strokeWidth: 2 } }}
            labelComponent={<VictoryTooltip />}
          />
        </VictoryChart>
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