import type { ParsedRow } from '../lib/excel';
import { PARAMASA_TEMPLATES, getSectionLabel, getRowIndentLevel, groupRowsBySection, splitParamasaPages, type ParamasaTemplateMode } from '../lib/paramasaPreview';

export type ParamasaPreviewMeta = {
  executorName: string;
  month: string;
  date: string;
  objectName: string;
  offerAccount: string;
  offerPositions: string;
  sectionTitle: string;
};

type Props = {
  rows: ParsedRow[];
  templateMode: ParamasaTemplateMode;
  meta: ParamasaPreviewMeta;
  viewMode: 'preview' | 'final';
};

function getTemplateLabel(templateId: number): string {
  return PARAMASA_TEMPLATES.find((template) => template.id === templateId)?.label || `Shablloni ${templateId} Faqe`;
}

export function ParamasaPreview({ rows, templateMode, meta, viewMode }: Props) {
  const pages = splitParamasaPages(rows, templateMode);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

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
          <strong>{pages.length}</strong>
          <span className="muted"> faqe</span>
        </div>
        <div>
          <strong>{templateMode === 'auto' ? 'Auto' : `${templateMode} faqe`}</strong>
          <span className="muted"> template</span>
        </div>
        <div>
          <strong>{total.toFixed(2)} €</strong>
          <span className="muted"> totali</span>
        </div>
      </div>

      {viewMode === 'preview' ? (
        <div className="paramasa-preview-grid">
          {pages.map((page) => (
            <section key={`page-${page.pageNumber}`} className="paramasa-page card">
              <header className="paramasa-page-header">
                <div>
                  <div className="paramasa-header-kicker">{meta.executorName || 'Kryesi i punes'}</div>
                  <strong>{meta.objectName || 'Objekti'}</strong>
                  <div className="muted">{meta.sectionTitle || 'Paramasa'}</div>
                </div>
                <div className="paramasa-page-badge">Faqja {page.pageNumber}</div>
              </header>

              <div className="paramasa-page-meta-grid">
                <div>
                  <span>Kryesi i punes</span>
                  <strong>{meta.executorName || '—'}</strong>
                </div>
                <div>
                  <span>Muaji / Data</span>
                  <strong>{meta.month || '—'} / {meta.date || '—'}</strong>
                </div>
                <div>
                  <span>Llogaria me oferte</span>
                  <strong>{meta.offerAccount || '—'}</strong>
                </div>
                <div>
                  <span>Pozicioni me oferte</span>
                  <strong>{meta.offerPositions || '—'}</strong>
                </div>
              </div>

              <div className="paramasa-template-note muted">
                {getTemplateLabel(page.templateId)} · {page.rows.length} pozicione në faqe
              </div>

              <div className="paramasa-row-list">
                {page.rows.map((row) => (
                    <article key={`${page.pageNumber}-${row.position_number}-${row.description}`} className="paramasa-row">
                      <div className="paramasa-row-top">
                        <strong>{row.position_number || '—'}</strong>
                        <span>{Number(row.total_price || 0).toFixed(2)} €</span>
                      </div>
                      <div className="paramasa-row-description">{row.description}</div>
                      <div className="paramasa-row-meta muted">
                        <span>{row.unit || '—'}</span>
                        <span>{Number(row.quantity || 0).toFixed(2)}</span>
                        <span>{Number(row.unit_price || 0).toFixed(2)} €/nj.</span>
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
                  <strong>{page.rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0).toFixed(2)} €</strong>
                </div>
              </footer>
            </section>
          ))}
        </div>
      ) : (
        <div className="paramasa-final-stack">
          {groupRowsBySection(rows).map((section, sectionIndex) => {
            const sectionRows = section.rows;
            const sectionPages = splitParamasaPages(sectionRows, templateMode);

            return sectionPages.map((page, pageIndex) => (
              <section key={`final-${section.sectionKey}-${page.pageNumber}-${pageIndex}`} className="libri-a4-page paramasa-final-page">
                <header className="libri-a4-header">
                  <div className="libri-a4-header-top">
                    <div>
                      <div className="libri-a4-kicker">{meta.executorName || 'Kryesi i punes'}</div>
                      <strong className="libri-a4-title">{meta.objectName || 'Objekti'}</strong>
                      <div className="libri-a4-subtitle">{meta.sectionTitle || 'Paramasa'} · {section.sectionLabel}</div>
                    </div>
                    <div className="libri-a4-meta-box">
                      <div><span>Kryesi i punes</span><strong>{meta.executorName || '—'}</strong></div>
                      <div><span>Muaji / Data</span><strong>{meta.month || '—'} / {meta.date || '—'}</strong></div>
                      <div><span>Llogaria me oferte</span><strong>{meta.offerAccount || '—'}</strong></div>
                    </div>
                  </div>
                  <div className="libri-a4-header-line" />
                </header>

                <div className="libri-a4-body">
                  <div className="libri-a4-page-info">
                    <span>Faqja {sectionIndex + 1}.{page.pageNumber}</span>
                    <span>{page.rows.length} pozicione</span>
                    <span>{getTemplateLabel(page.templateId)}</span>
                    <strong>Totali i faqes: {page.rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0).toFixed(2)} €</strong>
                  </div>

                  <div className="libri-a4-table paramasa-final-table">
                    <div className="libri-a4-table-head paramasa-final-table-head">
                      <span>Poz.</span>
                      <span>Përshkrimi</span>
                      <span>Njësia</span>
                      <span>Sasia</span>
                      <span>Gjithsej</span>
                    </div>

                    <div className="libri-a4-table-body">
                      {page.rows.map((row) => (
                        <article key={`${section.sectionKey}-${page.pageNumber}-${row.position_number}-${row.description}`} className="libri-a4-row paramasa-final-row">
                          <div className="libri-a4-pos-cell">
                            <span className="libri-kind libri-kind-numra">{getSectionLabel(row.position_number)}</span>
                            <strong>{row.position_number || '—'}</strong>
                          </div>
                          <div className="libri-a4-desc-cell" style={{ paddingLeft: `${getRowIndentLevel(row.position_number) * 10}px` }}>{row.description}</div>
                          <div className="libri-a4-unit-cell">{row.unit || '—'}</div>
                          <div className="libri-a4-number-cell">{Number(row.quantity || 0).toFixed(2)}</div>
                          <div className="libri-a4-number-cell libri-a4-total-cell">{Number(row.total_price || 0).toFixed(2)}</div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="libri-a4-footer">
                    <div className="libri-a4-signature-grid">
                      <div className="libri-a4-signature-block"><span>Përgatiti</span><div className="libri-a4-signature-line" /></div>
                      <div className="libri-a4-signature-block"><span>Kontrolloi</span><div className="libri-a4-signature-line" /></div>
                      <div className="libri-a4-signature-block"><span>Miratoi</span><div className="libri-a4-signature-line" /></div>
                    </div>
                    <div className="libri-a4-footer-note">
                      <span>{meta.offerPositions || 'Pozicionet vendosen automatikisht nga sistemi'}</span>
                      <strong>{meta.offerAccount || '—'}</strong>
                    </div>
                  </div>
                </div>
              </section>
            ));
          })}
        </div>
      )}
    </div>
  );
}
