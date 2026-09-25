import type { MonthlyRevenuePoint } from '../services/insights';

type Props = {
  points: MonthlyRevenuePoint[];
};

const formatEuro = (value: number) => `${value.toLocaleString('sq-AL', { maximumFractionDigits: 0 })} €`;

export function RevenueTrendChart({ points }: Props) {
  if (points.length === 0) {
    return <p className="muted field-hint">Nuk ka ende pozicione të regjistruara me datë, prandaj nuk ka trend mujor për të shfaqur.</p>;
  }

  const totalValue = points.reduce((sum, point) => sum + point.total, 0);
  const totalItems = points.reduce((sum, point) => sum + point.count, 0);
  const bestMonth = points.reduce((best, point) => (point.total > best.total ? point : best), points[0]);
  const latestMonth = points[points.length - 1];
  const previousMonth = points[points.length - 2];
  const changePercent = previousMonth && previousMonth.total > 0
    ? Math.round(((latestMonth.total - previousMonth.total) / previousMonth.total) * 100)
    : null;
  const highestValue = Math.max(...points.map((point) => point.total), 1);
  const recentPoints = points.slice(-6);

  return (
    <div className="revenue-trend">
      <div className="revenue-trend-summary">
        <div>
          <span className="muted">Muaji i fundit</span>
          <strong>{latestMonth.label}: {formatEuro(latestMonth.total)}</strong>
          <small>{latestMonth.count} pozicione</small>
        </div>
        <div>
          <span className="muted">Krahasuar me muajin paraprak</span>
          <strong className={changePercent === null ? '' : changePercent >= 0 ? 'diff-up' : 'diff-down'}>
            {changePercent === null ? 'Nuk ka krahasim' : `${changePercent >= 0 ? '+' : ''}${changePercent}%`}
          </strong>
          <small>{previousMonth ? `${previousMonth.label} → ${latestMonth.label}` : 'Duhet edhe një muaj'}</small>
        </div>
        <div>
          <span className="muted">Muaji më i fortë</span>
          <strong>{bestMonth.label}: {formatEuro(bestMonth.total)}</strong>
          <small>{totalItems} pozicione · total {formatEuro(totalValue)}</small>
        </div>
      </div>

      <p className="muted chart-subtitle revenue-trend-intro">
        {points.length > recentPoints.length ? `Po shfaqen 6 muajt e fundit nga ${points.length} muaj me të dhëna. ` : ''}Çdo rresht tregon vlerën e ofertuar në atë muaj.
      </p>

      <div className="revenue-trend-list" aria-label="Vlera e ofertuar sipas muajit">
        {recentPoints.map((point) => (
          <div className="revenue-trend-row" key={point.month}>
            <div className="revenue-trend-label">
              <strong>{point.label}</strong>
              <span>{point.count} pozicione · mesatarja {formatEuro(point.average)}</span>
            </div>
            <div className="revenue-trend-bar-track" aria-hidden="true">
              <span className="revenue-trend-bar" style={{ width: `${Math.max(4, (point.total / highestValue) * 100)}%` }} />
            </div>
            <strong className="revenue-trend-value">{formatEuro(point.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
