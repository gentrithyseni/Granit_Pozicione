import { useMemo, useState } from 'react';
import { Layers, LayoutGrid, X } from 'lucide-react';
import type { ParsedRow } from '../lib/excel';
import { groupRowsBySection } from '../lib/paramasaPreview';
import { planLibriExport, buildLibriExportPositions, buildLibriSinglePageWorkbook, downloadWorkbookBuffer, extractSectionAccountNumber, type LibriExportPlanPage } from '../lib/libriExport';
import { mergeAdjacentPlanPages, splitPlanPage, movePositionToPage } from '../lib/libriPlanEditor';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';

export type { ParamasaPreviewMeta };

export type PageGroupingMode = 'auto' | 'manual';

type Props = {
  rows: ParsedRow[];
  meta: ParamasaPreviewMeta;
  sectionTitleOverrides?: Record<string, string>;
  onUpdateRow?: (row: ParsedRow, changes: Partial<ParsedRow>) => void;
  /** Plan i fiksuar (p.sh. ndërtuesi manual) — anashkalon planLibriExport. */
  planOverride?: LibriExportPlanPage[];
  groupingMode?: PageGroupingMode;
  onGroupingModeChange?: (mode: PageGroupingMode) => void;
  manualPlan?: LibriExportPlanPage[] | null;
  onManualPlanChange?: (plan: LibriExportPlanPage[]) => void;
  onPlanError?: (message: string) => void;
};

export function ParamasaPreview({
  rows,
  meta,
  sectionTitleOverrides,
  onUpdateRow,
  planOverride,
  groupingMode = 'auto',
  onGroupingModeChange,
  manualPlan,
  onManualPlanChange,
  onPlanError,
}: Props) {
  const autoPlan = useMemo(
    () => planLibriExport(rows, sectionTitleOverrides),
    [rows, sectionTitleOverrides]
  );

  const sections = useMemo(() => {
    const grouped = groupRowsBySection(rows);
    return grouped.map((section) => ({
      ...section,
      sectionLabel: sectionTitleOverrides?.[section.sectionKey] ?? section.sectionLabel,
    }));
  }, [rows, sectionTitleOverrides]);

  const plan = planOverride ?? (groupingMode === 'manual' && manualPlan ? manualPlan : autoPlan);
  const isManual = groupingMode === 'manual' && Boolean(onManualPlanChange);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const overflowCount = plan.filter((page) => page.overflowWarning).length;
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [groupingOpen, setGroupingOpen] = useState(false);
  const [splitTarget, setSplitTarget] = useState<number | null>(null);
  const comparisonLabel = isManual ? `Auto: ${autoPlan.length} faqe → tani: ${plan.length} faqe` : null;
  const [moveTarget, setMoveTarget] = useState<{ pageIndex: number; rowIndex: number } | null>(null);

  const applyPlanChange = (result: LibriExportPlanPage[] | { error: string }) => {
    if ('error' in result) {
      onPlanError?.(result.error);
      return;
    }
    onManualPlanChange?.(result);
  };

  const handleDownloadPage = async (pageIndex: number) => {
    const page = plan[pageIndex];
    if (!page) return;
    setDownloadingPage(pageIndex);
    try {
      const buffer = await buildLibriSinglePageWorkbook(page, meta);
      const safeLabel = (page.sectionLabel || `Faqja-${pageIndex + 1}`).replace(/[^\w.-]+/g, '-');
      downloadWorkbookBuffer(buffer, `Faqja-${pageIndex + 1}-${safeLabel}.xlsx`);
    } finally {
      setDownloadingPage(null);
    }
  };

  if (rows.length === 0) {
    return <div className="muted">Nuk ka të dhëna për preview.</div>;
  }

  return (
    <div className="paramasa-preview-stack">
      <div className="libri-preview-bar">
        <div className="libri-preview-stats">
          <div className="libri-stat-pill">
            <span className="muted">Pozicione</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="libri-stat-pill">
            <span className="muted">Faqe</span>
            <strong>{plan.length}</strong>
          </div>
          <div className="libri-stat-pill">
            <span className="muted">Totali</span>
            <strong>{total.toFixed(2)} €</strong>
          </div>
          {overflowCount > 0 ? (
            <div className="paramasa-overflow-badge">
              <strong>{overflowCount}</strong>
              <span> përshkrim i gjatë</span>
            </div>
          ) : null}
        </div>

        <div className="libri-preview-bar-actions">
          <button type="button" className="primary-button libri-bar-btn" onClick={() => setSectionsOpen(true)}>
            <Layers size={16} />
            Shiko pozicionet
          </button>
          {onGroupingModeChange && (
            <>
              <div className="view-switch">
                <button
                  type="button"
                  className={`filter-chip ${groupingMode === 'auto' ? 'active' : ''}`}
                  onClick={() => onGroupingModeChange('auto')}
                >
                  Automatik
                </button>
                <button
                  type="button"
                  className={`filter-chip ${groupingMode === 'manual' ? 'active' : ''}`}
                  onClick={() => {
                    onGroupingModeChange('manual');
                    setGroupingOpen(true);
                  }}
                >
                  Manual
                </button>
              </div>
              {isManual && (
                <button type="button" className="card libri-bar-btn" onClick={() => setGroupingOpen(true)}>
                  <LayoutGrid size={16} />
                  Rregullo faqet
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isManual && (
        <div className="libri-manual-compare">
          <span className="muted">Krahasim i shpejtë</span>
          <strong>{comparisonLabel}</strong>
          <button type="button" className="card" onClick={() => onManualPlanChange?.(autoPlan)}>
            Rikthe automatikun
          </button>
        </div>
      )}

      {sectionsOpen && (
        <div className="edit-modal-backdrop" onClick={() => setSectionsOpen(false)}>
          <div className="edit-modal-shell libri-popup-shell" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-head">
              <div>
                <h3>Pozicionet sipas seksionit</h3>
                <p className="muted field-hint">{sections.length} seksione · {rows.length} pozicione</p>
              </div>
              <button type="button" className="card import-cancel-btn" onClick={() => setSectionsOpen(false)} aria-label="Mbyll">
                <X size={16} />
              </button>
            </div>
            <div className="libri-sections-grid">
              {sections.map((section) => (
                <article key={section.sectionKey} className="libri-section-card">
                  <header className="libri-section-card-head">
                    <strong>{section.sectionLabel}</strong>
                    <span className="libri-section-count">{section.rows.length} poz.</span>
                  </header>
                  <ul className="libri-section-positions">
                    {section.rows.map((row, i) => (
                      <li key={`${section.sectionKey}-${row.position_number}-${i}`}>
                        <span className="libri-section-pos-nr">{row.position_number || '—'}</span>
                        <span className="libri-section-pos-desc">{row.description || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {groupingOpen && isManual && (
        <div className="edit-modal-backdrop" onClick={() => setGroupingOpen(false)}>
          <div className="edit-modal-shell libri-popup-shell" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-head">
              <div>
                <h3>Bashko ose ndaj faqet</h3>
                <p className="muted field-hint">Ndryshimet zbatohen menjëherë te preview dhe te shkarkimi.</p>
              </div>
              <div className="libri-popup-head-actions">
                <button type="button" className="card" onClick={() => onManualPlanChange?.(autoPlan)}>
                  Rikthe automatikun
                </button>
                <button type="button" className="card import-cancel-btn" onClick={() => setGroupingOpen(false)} aria-label="Mbyll">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="libri-grouping-list">
              {plan.map((page, pageIndex) => (
                <article key={`group-${pageIndex}`} className="libri-grouping-card">
                  <header className="libri-grouping-card-head">
                    <span className="paramasa-page-badge">Faqja {pageIndex + 1}</span>
                    <strong>{page.sectionLabel || '—'}</strong>
                    <span className="muted">Shablloni {page.templateId} · {page.rows.length} poz.</span>
                  </header>
                  <ol className="libri-grouping-positions">
                    {page.rows.map((row, rowIndex) => (
                      <li key={`gpos-${pageIndex}-${rowIndex}`}>
                        <span className="libri-section-pos-nr">{row.position_number || `#${rowIndex + 1}`}</span>
                        <span className="libri-section-pos-desc">{row.description || '—'}</span>
                        {page.rows.length > 1 && (
                          <button
                            type="button"
                            className="filter-chip"
                            onClick={() =>
                              setMoveTarget(
                                moveTarget?.pageIndex === pageIndex && moveTarget.rowIndex === rowIndex
                                  ? null
                                  : { pageIndex, rowIndex }
                              )
                            }
                          >
                            Lëviz
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  {moveTarget?.pageIndex === pageIndex && (
                    <div className="libri-move-picker">
                      <span className="muted">Dërgo te:</span>
                      {plan.map((_, destIndex) =>
                        destIndex !== pageIndex ? (
                          <button
                            key={`move-${pageIndex}-${destIndex}`}
                            type="button"
                            className="filter-chip"
                            onClick={() => {
                              applyPlanChange(movePositionToPage(plan, pageIndex, moveTarget.rowIndex, destIndex));
                              setMoveTarget(null);
                            }}
                          >
                            Faqja {destIndex + 1}
                          </button>
                        ) : null
                      )}
                    </div>
                  )}
                  <div className="libri-page-manual-actions">
                    {pageIndex < plan.length - 1 && (
                      <button
                        type="button"
                        className="filter-chip"
                        onClick={() => applyPlanChange(mergeAdjacentPlanPages(plan, pageIndex))}
                      >
                        Bashko me faqen {pageIndex + 2}
                      </button>
                    )}
                    {page.rows.length > 1 && (
                      <button
                        type="button"
                        className="filter-chip"
                        onClick={() => setSplitTarget(splitTarget === pageIndex ? null : pageIndex)}
                      >
                        {splitTarget === pageIndex ? 'Anulo ndarjen' : 'Ndaj faqen'}
                      </button>
                    )}
                  </div>
                  {splitTarget === pageIndex && page.rows.length > 1 && (
                    <div className="libri-split-picker">
                      <span className="muted">Nda pas:</span>
                      {page.rows.slice(0, -1).map((row, rowIndex) => (
                        <button
                          key={`split-${pageIndex}-${rowIndex}`}
                          type="button"
                          className="filter-chip"
                          onClick={() => {
                            applyPlanChange(splitPlanPage(plan, pageIndex, rowIndex + 1));
                            setSplitTarget(null);
                          }}
                        >
                          {row.position_number || `#${rowIndex + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="paramasa-preview-grid">
        {plan.map((page, pageIndex) => {
          const positions = buildLibriExportPositions(page.rows);
          const pageTotal = page.rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

          return (
            <section key={`page-${pageIndex}-${page.rows.map((r) => r.position_number).join('-')}`} className="paramasa-page card">
              <header className="paramasa-page-header">
                <div>
                  <div className="paramasa-header-kicker">{meta.executorName || 'Kryesi i punes'}</div>
                  <strong>{meta.objectName || 'Objekti'}</strong>
                  <div className="muted">{page.sectionLabel}</div>
                </div>
                <div className="paramasa-page-badge">Faqja {pageIndex + 1}</div>
              </header>

              <div className="paramasa-page-btn-row">
                <button
                  type="button"
                  className="filter-chip"
                  onClick={() => setExpandedPage(expandedPage === pageIndex ? null : pageIndex)}
                >
                  {expandedPage === pageIndex ? 'Mbyll mini-print' : 'Mini-print A4'}
                </button>
                <button
                  type="button"
                  className="filter-chip paramasa-page-download-btn"
                  onClick={() => handleDownloadPage(pageIndex)}
                  disabled={downloadingPage === pageIndex}
                >
                  {downloadingPage === pageIndex ? 'Duke gjeneruar…' : 'Shkarko këtë faqe (.xlsx)'}
                </button>
              </div>

              {expandedPage === pageIndex && (
                <div className="edit-modal-backdrop" onClick={() => setExpandedPage(null)}>
                  <div className="edit-modal-shell libri-popup-shell libri-a4-modal-shell" onClick={(e) => e.stopPropagation()}>
                    <div className="edit-modal-head">
                      <div>
                        <h3>Mini-print A4</h3>
                        <p className="muted field-hint">Pamja e faqes para shkarkimit — e ngjashme me print preview të Excel-it.</p>
                      </div>
                      <button type="button" className="card import-cancel-btn" onClick={() => setExpandedPage(null)} aria-label="Mbyll">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="libri-facsimile libri-preview-modal-body">
                      {onUpdateRow && (
                        <div className="libri-fac-edit-hint">✎ Redaktim aktiv — ndryshimet ruhen automatikisht dhe ndikojnë te shkarkimi.</div>
                      )}
                      <div className="libri-fac-row libri-fac-top">
                        <div>
                          <div className="libri-fac-kicker">Kryesi i punëve "{meta.executorName || '—'}"</div>
                          <div className="libri-fac-kicker-sub">Executor of the works</div>
                        </div>
                        <div className="libri-fac-right">Muaji-Month {meta.month || '—'}</div>
                      </div>
                      <div className="libri-fac-title">Libri ndërtimor - Construction book</div>
                      <div className="libri-fac-row">
                        <div>Pozicioni i punës - Working positions</div>
                        <div className="libri-fac-right">Objekti-Building : {meta.objectName || '—'}</div>
                      </div>
                      <div className="libri-fac-section-title">{page.sectionLabel || '—'}</div>
                      <div className="libri-fac-row libri-fac-offer-row">
                        <div>Llogaria me ofertë: <strong>No {page.sectionLabel ? extractSectionAccountNumber(page.sectionLabel) : '—'}</strong></div>
                        <div className="libri-fac-right">Poz. Me ofertë: <strong>{positions.map((p) => p.positionNumber).join(', ') || '—'}</strong></div>
                      </div>
                      <div className="libri-fac-row libri-fac-unit-row">
                        <div>Njësia matëse € : {positions[0]?.unit || '—'}</div>
                      </div>
                      {positions.map((position, posIndex) => {
                        const sourceRow = page.rows[posIndex];
                        return (
                          <div key={`fac-${posIndex}`} className="libri-fac-position">
                            {onUpdateRow && sourceRow ? (
                              <>
                                <div className="libri-fac-edit-row">
                                  <label className="libri-fac-edit-label">
                                    Nr. Poz.
                                    <input
                                      type="text"
                                      value={sourceRow.position_number}
                                      onChange={(e) => onUpdateRow(sourceRow, { position_number: e.target.value })}
                                    />
                                  </label>
                                  <label className="libri-fac-edit-label">
                                    Njësia
                                    <input
                                      type="text"
                                      value={sourceRow.unit}
                                      onChange={(e) => onUpdateRow(sourceRow, { unit: e.target.value })}
                                    />
                                  </label>
                                  <label className="libri-fac-edit-label">
                                    Sasia
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={sourceRow.quantity}
                                      onChange={(e) => {
                                        const quantity = Number(e.target.value) || 0;
                                        const unitPrice = Number(sourceRow.unit_price) || 0;
                                        onUpdateRow(sourceRow, { quantity, total_price: quantity * unitPrice });
                                      }}
                                    />
                                  </label>
                                  <label className="libri-fac-edit-label">
                                    Çmimi (€)
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={sourceRow.unit_price}
                                      onChange={(e) => {
                                        const unitPrice = Number(e.target.value) || 0;
                                        const quantity = Number(sourceRow.quantity) || 0;
                                        onUpdateRow(sourceRow, { unit_price: unitPrice, total_price: quantity * unitPrice });
                                      }}
                                    />
                                  </label>
                                </div>
                                <label className="libri-fac-edit-label libri-fac-edit-desc">
                                  Përshkrimi
                                  <textarea
                                    value={sourceRow.description}
                                    rows={3}
                                    onChange={(e) => onUpdateRow(sourceRow, { description: e.target.value })}
                                  />
                                </label>
                                <div className="libri-fac-total-row">
                                  <span>Gjithsejt :</span>
                                  <strong>{Number(sourceRow.quantity || 0).toFixed(2)}</strong>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="libri-fac-desc">
                                  <strong>{position.positionNumber}</strong> {position.description}
                                </div>
                                <div className="libri-fac-measure-row">
                                  <span>{position.lines.map((l) => l.label).join(', ')}</span>
                                  <strong>{position.lines.reduce((s, l) => s + l.value, 0).toFixed(2)}</strong>
                                </div>
                                <div className="libri-fac-total-row">
                                  <span>Gjithsejt :</span>
                                  <strong>{position.total.toFixed(2)}</strong>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      <div className="libri-fac-signatures">
                        <span>Kryesi i punëve : ________________</span>
                        <span>Organi mbikëqyrës: ________________</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="paramasa-page-meta-grid">
                <div>
                  <span>Muaji / Data</span>
                  <strong>{meta.month || '—'} / {meta.date || '—'}</strong>
                </div>
                <div>
                  <span>Seksioni</span>
                  <strong>{page.sectionLabel || '—'}</strong>
                </div>
                <div>
                  <span>Llogaria me ofertë</span>
                  <strong>No {page.sectionLabel ? extractSectionAccountNumber(page.sectionLabel) : '—'}</strong>
                </div>
                <div>
                  <span>Poz. me ofertë</span>
                  <strong>{positions.map((p) => p.positionNumber).join(', ') || '—'}</strong>
                </div>
              </div>

              <div className="paramasa-template-note muted">
                Shablloni-{page.templateId}-Faqe · {page.rows.length} pozicione në faqe
                {page.overflowWarning ? ' · ⚠ përshkrim i gjatë, kontrollo faqen' : ''}
                {page.mixedUnitsWarning ? ' · ⚠ njësi të përziera në faqe' : ''}
              </div>

              <div className="paramasa-row-list">
                {positions.map((position, posIndex) => (
                  <article key={`${pageIndex}-${position.positionNumber}-${posIndex}`} className="paramasa-row">
                    <div className="paramasa-row-top">
                      <strong>{position.positionNumber || '—'}</strong>
                      <span>{Number(page.rows[posIndex]?.total_price || 0).toFixed(2)} €</span>
                    </div>
                    <div className="paramasa-row-description">{position.description}</div>
                    <div className="paramasa-row-meta muted">
                      <span>{position.unit || '—'}</span>
                      <span>{position.lines.map((l) => l.label).join(' | ')}</span>
                      <span>Gjithsejt: {position.total.toFixed(2)}</span>
                    </div>
                  </article>
                ))}
              </div>

              <footer className="paramasa-page-footer">
                <div>
                  <span>Pozicioni i punes</span>
                  <strong>{page.rows[0]?.position_number || '—'}</strong>
                </div>
                <div>
                  <span>Totali i faqes</span>
                  <strong>{pageTotal.toFixed(2)} €</strong>
                </div>
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
