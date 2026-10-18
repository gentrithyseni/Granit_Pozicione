import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, CircleDollarSign } from 'lucide-react';
import { fetchProfitSummaryByProject, type ProfitSummary } from '../services/priceHistory';

type Props = {
  refreshKey?: number;
};

const COST_TYPES = [
  { key: 'materialCost', label: 'Material', color: 'cost-material' },
  { key: 'laborCost', label: 'Punë', color: 'cost-labor' },
  { key: 'foodCost', label: 'Ushqim', color: 'cost-food' },
  { key: 'transportCost', label: 'Transport', color: 'cost-transport' },
  { key: 'otherCost', label: 'Të tjera', color: 'cost-other' },
] as const;

type CostKey = (typeof COST_TYPES)[number]['key'];

const formatMoney = (value: number) => `${value.toLocaleString('sq-AL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} €`;

/** Përmbledh strukturën e kostove dhe fitimin e pritshëm për projektet e regjistruara. */
export function PriceHistoryDashboard({ refreshKey = 0 }: Props) {
  const [profitSummary, setProfitSummary] = useState<ProfitSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCostProjectId, setSelectedCostProjectId] = useState('');
  const [profitProjectIndex, setProfitProjectIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchProfitSummaryByProject()
      .then((summary) => {
        if (active) setProfitSummary(summary);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Analiza financiare dështoi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const costTotals = useMemo(() => profitSummary.reduce<Record<CostKey, number>>((totals, project) => {
    COST_TYPES.forEach(({ key }) => {
      totals[key] += project[key];
    });
    return totals;
  }, {
    materialCost: 0,
    laborCost: 0,
    foodCost: 0,
    transportCost: 0,
    otherCost: 0,
  }), [profitSummary]);

  const selectedProject = profitSummary.find((project) => project.projectId === selectedCostProjectId);
  const displayedCosts = selectedProject
    ? COST_TYPES.map((type) => ({ ...type, value: selectedProject[type.key] }))
    : COST_TYPES.map((type) => ({ ...type, value: costTotals[type.key] }));
  const displayedCostTotal = displayedCosts.reduce((sum, item) => sum + item.value, 0);
  const knownCostProjects = profitSummary.filter((project) => project.hasCostData);
  const totalNet = profitSummary.reduce((sum, project) => sum + project.plannedTotal, 0);
  const totalVat = profitSummary.reduce((sum, project) => sum + project.vatAmount, 0);
  const totalGross = profitSummary.reduce((sum, project) => sum + project.totalWithVat, 0);
  const totalRegisteredCost = Object.values(costTotals).reduce((sum, value) => sum + value, 0);
  const totalExpectedProfit = knownCostProjects.reduce(
    (sum, project) => sum + (project.profitAmount ?? 0),
    0
  );
  const profitProjects = profitSummary;
  useEffect(() => {
    setProfitProjectIndex((index) => Math.min(index, Math.max(0, profitProjects.length - 1)));
  }, [profitProjects.length]);
  const displayedProfitProject = profitProjects[profitProjectIndex] ?? null;

  return (
    <div id="price-analysis" className="panel panel-top-gap">
      <div className="price-history-heading">
        <div>
          <h3 className="panel-heading-accent"><BarChart3 size={17} className="panel-heading-icon" /> Analiza financiare</h3>
          <p className="muted">Kostot e regjistruara krahasohen me vlerën e ofertës pa TVSH; TVSH-ja paraqitet veçmas.</p>
        </div>
        <span className="price-history-purpose">Për vendimmarrje</span>
      </div>

      {error && <p className="field-error">{error}</p>}
      {loading && <p className="muted field-hint">Duke ngarkuar analizën financiare…</p>}
      {!loading && !error && profitSummary.length === 0 && (
        <p className="muted field-hint">Ende nuk ka projekte me pozicione për analizë.</p>
      )}

      {!loading && !error && profitSummary.length > 0 && (
        <div className="price-history-grid">
          <section className="price-history-chart-box" aria-labelledby="cost-structure-title">
            <div className="price-history-box-head">
              <div>
                <span className="price-history-kicker">Kostot</span>
                <h4 id="cost-structure-title" className="price-history-subheading">Struktura e kostove</h4>
              </div>
              <label className="price-history-select-label">
                Shfaq sipas
                <select value={selectedCostProjectId} onChange={(event) => setSelectedCostProjectId(event.target.value)}>
                  <option value="">Të gjitha projektet</option>
                  {profitSummary.map((project) => (
                    <option key={project.projectId} value={project.projectId}>{project.projectName}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted field-hint">
              {selectedProject
                ? `Ndarja e kostove të projektit “${selectedProject.projectName}”.`
                : 'Përmbledhje e kostove të regjistruara në të gjitha projektet.'}
            </p>
            {displayedCostTotal <= 0 ? (
              <p className="muted field-hint">Nuk ka kosto të regjistruara për këtë përzgjedhje.</p>
            ) : (
              <>
                <div className="cost-structure-bar" role="img" aria-label="Përbërja e kostove sipas kategorisë">
                  {displayedCosts.filter((item) => item.value > 0).map((item) => (
                    <span
                      key={item.key}
                      className={item.color}
                      style={{ width: `${(item.value / displayedCostTotal) * 100}%` }}
                      title={`${item.label}: ${formatMoney(item.value)}`}
                    />
                  ))}
                </div>
                <div className="cost-structure-legend">
                  {displayedCosts.map((item) => (
                    <div className="cost-structure-row" key={item.key}>
                      <span className={`cost-structure-dot ${item.color}`} />
                      <span>{item.label}</span>
                      <strong>{formatMoney(item.value)}</strong>
                      <small>{displayedCostTotal > 0 ? `${((item.value / displayedCostTotal) * 100).toFixed(1)}%` : '0.0%'}</small>
                    </div>
                  ))}
                </div>
                <div className="cost-structure-total">
                  <span>Kosto e regjistruar</span>
                  <strong>{formatMoney(displayedCostTotal)}</strong>
                </div>
              </>
            )}
            <p className="muted field-hint">
              Kostot mblidhen nga pozicionet: material, punë, ushqim, transport dhe të tjera.
            </p>
          </section>

          <section className="price-history-chart-box" aria-labelledby="project-profit-title">
            <div className="price-history-box-head">
              <div>
                <span className="price-history-kicker">Projektet</span>
                <h4 id="project-profit-title" className="price-history-subheading">Fitimi i pritshëm</h4>
              </div>
              <CircleDollarSign size={20} className="price-history-box-icon" />
            </div>
            <div className="profit-summary-strip">
              <div><span>Vlera pa TVSH</span><strong>{formatMoney(totalNet)}</strong></div>
              <div><span>TVSH</span><strong>{formatMoney(totalVat)}</strong></div>
              <div><span>Çmimi përfundimtar</span><strong>{formatMoney(totalGross)}</strong></div>
            </div>
            <div className="profit-summary-strip profit-summary-strip-bottom">
              <div><span>Kosto e regjistruar</span><strong>{formatMoney(totalRegisteredCost)}</strong></div>
              <div><span>Fitimi i pritshëm*</span><strong className={totalExpectedProfit >= 0 ? 'diff-up' : 'diff-down'}>{formatMoney(totalExpectedProfit)}</strong></div>
              <div><span>Projekte me kosto</span><strong>{knownCostProjects.length} / {profitSummary.length}</strong></div>
            </div>
            {displayedProfitProject && (
              <>
                <article className="profit-project-card" aria-live="polite">
                  <h5>{displayedProfitProject.projectName}</h5>
                  <div><span>Pa TVSH</span><strong>{formatMoney(displayedProfitProject.plannedTotal)}</strong></div>
                  <div><span>TVSH</span><strong>{formatMoney(displayedProfitProject.vatAmount)}</strong></div>
                  <div><span>Çmimi përfundimtar</span><strong>{formatMoney(displayedProfitProject.totalWithVat)}</strong></div>
                  <div>
                    <span>Kosto {displayedProfitProject.hasCostData ? '' : '(e paplotë)'}</span>
                    <strong>
                      {displayedProfitProject.hasCostData
                        ? formatMoney(displayedProfitProject.plannedCost)
                        : displayedProfitProject.hasAnyCostData
                          ? `${formatMoney(displayedProfitProject.plannedCost)} · ${displayedProfitProject.itemsWithCost}/${displayedProfitProject.itemCount} pozicione`
                          : 'Pa të dhëna'}
                    </strong>
                  </div>
                  <div>
                    <span>Fitimi i pritshëm*</span>
                    <strong className={
                      displayedProfitProject.profitAmount == null
                        ? ''
                        : displayedProfitProject.profitAmount >= 0
                          ? 'diff-up'
                          : 'diff-down'
                    }>
                      {displayedProfitProject.profitAmount == null
                        ? '—'
                        : formatMoney(displayedProfitProject.profitAmount)}
                    </strong>
                  </div>
                  {displayedProfitProject.actualCost != null && (
                    <div>
                      <span>Fitimi sipas kostos reale</span>
                      <strong>
                        {displayedProfitProject.realProfitAmount == null
                          ? '—'
                          : formatMoney(displayedProfitProject.realProfitAmount)}
                      </strong>
                    </div>
                  )}
                </article>
                <nav className="profit-project-pagination" aria-label="Projektet e fitimit të pritshëm">
                  <button
                    type="button"
                    className="card"
                    onClick={() => setProfitProjectIndex((index) => Math.max(0, index - 1))}
                    disabled={profitProjectIndex === 0}
                    aria-label="Projekti i mëparshëm"
                  >
                    <ChevronLeft size={16} />
                    Mëparshmi
                  </button>
                  <span>{profitProjectIndex + 1} / {profitProjects.length}</span>
                  <button
                    type="button"
                    className="card"
                    onClick={() => setProfitProjectIndex((index) => Math.min(profitProjects.length - 1, index + 1))}
                    disabled={profitProjectIndex >= profitProjects.length - 1}
                    aria-label="Projekti tjetër"
                  >
                    Tjetri
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </>
            )}
            <p className="muted field-hint">
              * Fitimi i pritshëm = vlera pa TVSH − kostot e regjistruara për të gjitha pozicionet. Për kosto të paplota ose të paregjistruara, fitimi nuk llogaritet.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
