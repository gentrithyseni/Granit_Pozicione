import type { MonthlyRevenuePoint } from '../services/insights';
import { PROJECT_STATUSES, type ProjectStatus } from '../constants/projectStatus';

type Props = {
  points: MonthlyRevenuePoint[];
  status: ProjectStatus | 'all';
  onStatusChange: (status: ProjectStatus | 'all') => void;
  loading?: boolean;
  error?: string | null;
};

const formatEuro = (value: number) => `${value.toLocaleString('sq-AL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function RevenueTrendChart({ points, status, onStatusChange, loading = false, error }: Props) {
  const hasOffers = points.some((point) => point.count > 0);
  const totalValue = points.reduce((sum, point) => sum + point.total, 0);
  const totalOffers = points.reduce((sum, point) => sum + point.count, 0);
  const totalPositions = points.reduce((sum, point) => sum + point.positionCount, 0);
  const activeMonths = points.filter((point) => point.count > 0);
  const bestMonth = activeMonths.reduce(
    (best, point) => (point.total > best.total ? point : best),
    activeMonths[0]
  );
  const latestMonth = points[points.length - 1];
  const previousMonth = points[points.length - 2];
  const changePercent = previousMonth && previousMonth.total > 0
    ? ((latestMonth.total - previousMonth.total) / previousMonth.total) * 100
    : null;
  const highestValue = Math.max(...points.map((point) => point.total), 1);
  const statusLabel = status === 'all' ? 'Të gjitha statuset' : PROJECT_STATUSES.find((entry) => entry.value === status)?.label;

  return (
    <div className="revenue-trend">
      <div className="revenue-trend-heading">
        <div>
          <span className="revenue-trend-eyebrow">Përmbledhje gjashtëmujore</span>
          <p className="revenue-trend-intro">
            Vlera e ofertave caktohet te muaji kur është krijuar projekti. Kjo nuk është vlerë e pagesave të pranuara apo fitim.
          </p>
        </div>
        <label className="revenue-trend-filter">
          Statusi i projekteve
          <select value={status} onChange={(event) => onStatusChange(event.target.value as ProjectStatus | 'all')}>
            <option value="all">Të gjitha</option>
            {PROJECT_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="field-error">{error}</p>}
      {loading && <p className="muted field-hint">Duke ngarkuar trendin...</p>}

      <div className="revenue-trend-summary">
        <div>
          <span className="muted">Vlera e ofertave · 6 muaj</span>
          <strong>{formatEuro(totalValue)}</strong>
          <small>{totalOffers} oferta · {totalPositions} pozicione</small>
        </div>
        <div>
          <span className="muted">Muaji aktual · {latestMonth?.label || '—'}</span>
          <strong>{formatEuro(latestMonth?.total || 0)}</strong>
          <small>{latestMonth?.count || 0} oferta · deri sot</small>
        </div>
        <div>
          <span className="muted">Ndryshimi mujor</span>
          <strong className={changePercent === null ? '' : changePercent >= 0 ? 'diff-up' : 'diff-down'}>
            {changePercent === null
              ? previousMonth?.total === 0 && latestMonth?.total === 0 ? 'Pa ndryshim' : 'Pa bazë krahasimi'
              : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`}
          </strong>
          <small>{previousMonth?.label || '—'} → {latestMonth?.label || '—'}</small>
        </div>
        <div>
          <span className="muted">Muaji me vlerën më të lartë</span>
          <strong>{bestMonth ? formatEuro(bestMonth.total) : '—'}</strong>
          <small>{bestMonth?.label || 'Pa oferta në periudhë'}</small>
        </div>
      </div>

      <div className="revenue-trend-chart-heading">
        <div><h4>Vlera mujore e ofertave</h4><span>{statusLabel} · 6 muaj kalendarikë, përfshirë muajt pa aktivitet</span></div>
        {hasOffers && <strong>{totalOffers} oferta gjithsej</strong>}
      </div>

      {!hasOffers && !loading && !error ? (
        <p className="revenue-trend-empty">Nuk ka oferta me pozicione në këtë periudhë dhe status.</p>
      ) : (
        <div className="revenue-trend-list" aria-label="Vlera e ofertave sipas muajit të krijimit të projektit">
          {points.map((point, index) => (
            <div className={`revenue-trend-row ${index === points.length - 1 ? 'current' : ''}`} key={point.month}>
              <div className="revenue-trend-label">
                <strong>{point.label}{index === points.length - 1 ? ' · Aktual' : ''}</strong>
                <span>{point.count} oferta · {point.positionCount} pozicione · mesatarja/ofertë {formatEuro(point.average)}</span>
              </div>
              <div
                className="revenue-trend-bar-track"
                role="img"
                aria-label={`${point.label}: ${formatEuro(point.total)}, ${point.count} oferta`}
              >
                <span className="revenue-trend-bar" style={{ width: `${point.total > 0 ? Math.max(1, (point.total / highestValue) * 100) : 0}%` }} />
              </div>
              <strong className="revenue-trend-value">{formatEuro(point.total)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
