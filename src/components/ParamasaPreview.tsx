import { useState } from 'react';
import type { ParsedRow } from '../lib/excel';
import { planLibriExport, buildLibriExportPositions, buildLibriSinglePageWorkbook, downloadWorkbookBuffer } from '../lib/libriExport';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';

export type { ParamasaPreviewMeta };

type Props = {
  rows: ParsedRow[];
  meta: ParamasaPreviewMeta;
};

/**
 * Preview që përdor SAKTËSISHT të njëjtin motor paketimi (planLibriExport) si eksporti real
 * i .xlsx-it (libriExport.ts) — çka shikon këtu është çka merr në skedar, gjithmonë, sepse
 * është e njëjta logjikë, jo një përafrim i veçantë për UI.
 */
export function ParamasaPreview({ rows, meta }: Props) {
  const plan = planLibriExport(rows);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const overflowCount = plan.filter((page) => page.overflowWarning).length;
  const [downloadingPage, setDownloadingPage] = useState<number | null>(null);

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
                  <div className="muted">{meta.sectionTitle || page.sectionLabel}</div>
                </div>
                <div className="paramasa-page-badge">Faqja {pageIndex + 1}</div>
              </header>

              <button
                type="button"
                className="filter-chip paramasa-page-download-btn"
                onClick={() => handleDownloadPage(pageIndex)}
                disabled={downloadingPage === pageIndex}
              >
                {downloadingPage === pageIndex ? 'Duke gjeneruar…' : 'Shkarko këtë faqe (.xlsx)'}
              </button>

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
                  <strong>No {page.sectionLabel?.replace(/\.$/, '') || '—'}</strong>
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