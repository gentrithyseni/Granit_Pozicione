import { useState } from 'react';
import type { ParsedRow } from '../lib/excel';
import { planLibriExport, buildLibriExportPositions, buildLibriSinglePageWorkbook, downloadWorkbookBuffer, extractSectionAccountNumber } from '../lib/libriExport';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';

export type { ParamasaPreviewMeta };

type Props = {
  rows: ParsedRow[];
  meta: ParamasaPreviewMeta;
  /** Titujt e seksioneve të redaktuar dorazi te "Paneli i Validimit" (çelësi: sectionKey). */
  sectionTitleOverrides?: Record<string, string>;
  /** Nëse jepet, "Shiko faqen" bëhet i redaktueshëm — thirret me rreshtin origjinal (referencë)
   * dhe fushat e ndryshuara, dhe prindi (ImportPage) i përditëson te state-i i vet i `rows`. */
  onUpdateRow?: (row: ParsedRow, changes: Partial<ParsedRow>) => void;
};

/**
 * Preview që përdor SAKTËSISHT të njëjtin motor paketimi (planLibriExport) si eksporti real
 * i .xlsx-it (libriExport.ts) — çka shikon këtu është çka merr në skedar, gjithmonë, sepse
 * është e njëjta logjikë, jo një përafrim i veçantë për UI.
 */
export function ParamasaPreview({ rows, meta, sectionTitleOverrides, onUpdateRow }: Props) {
  const plan = planLibriExport(rows, sectionTitleOverrides);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const overflowCount = plan.filter((page) => page.overflowWarning).length;
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

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
      <div className="paramasa-preview-summary">
        <div>
          <strong>{rows.length}</strong>
          <span className="muted"> pozicione</span>
        </div>
        <div>
          <strong>{plan.length}</strong>
          <span className="muted"> faqe (auto)</span>
        </div>
        <div>
          <strong>{total.toFixed(2)} €</strong>
          <span className="muted"> totali</span>
        </div>
        {overflowCount > 0 ? (
          <div className="paramasa-overflow-badge">
            <strong>{overflowCount}</strong>
            <span> faqe me përshkrim të gjatë — kontrollo manualisht</span>
          </div>
        ) : null}
      </div>

      <div className="paramasa-preview-grid">
        {plan.map((page, pageIndex) => {
          const positions = buildLibriExportPositions(page.rows);
          const pageTotal = page.rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

          return (
            <section key={`page-${pageIndex}`} className="paramasa-page card">
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
                  {expandedPage === pageIndex ? 'Mbyll pamjen' : 'Shiko faqen'}
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
                <div className="libri-facsimile">
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
                              <strong>{Number(sourceRow.total_price || 0).toFixed(2)}</strong>
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