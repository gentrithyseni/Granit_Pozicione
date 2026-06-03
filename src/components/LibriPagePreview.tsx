import type { ParsedRow } from '../lib/excel';
import {
  enhanceRows,
  getKindLabel,
  splitIntoPages,
  validatePages,
  type LibriPreviewMeta,
} from '../lib/libriPages';

type PageGroup = {
  key: string;
  fileName: string;
  rows: ParsedRow[];
};

type Props = {
  rows: ParsedRow[];
  meta: LibriPreviewMeta;
};

function groupRows(rows: ParsedRow[]): PageGroup[] {
  const groups = new Map<string, PageGroup>();

  rows.forEach((row) => {
    const fileName = row.sheet_name || 'Import';
    const key = `${fileName}::Sheet`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    groups.set(key, {
      key,
      fileName,
      rows: [row],
    });
  });

  return Array.from(groups.values());
}


export function LibriPagePreview({ rows, meta }: Props) {
  const groups = groupRows(rows).slice(0, 12);
  const bookRows = enhanceRows(rows);
  const pages = splitIntoPages(bookRows);
  const validationIssues = validatePages(pages);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const countByKind = bookRows.reduce(
    (acc, row) => {
      acc[row.positionKind] += 1;
      return acc;
    },
    { numra: 0, romake: 0, shkronja: 0, tjeter: 0 }
  );

  return (
    <div className="libri-preview-stack">
      <div className="libri-preview-summary">
        <div>
          <strong>{rows.length}</strong>
          <span className="muted"> pozicione</span>
        </div>
        <div>
          <strong>{pages.length || 1}</strong>
          <span className="muted"> faqe A4</span>
        </div>
        <div>
          <strong>{countByKind.numra}</strong>
          <span className="muted"> me numra</span>
        </div>
        <div>
          <strong>{countByKind.romake}</strong>
          <span className="muted"> romake</span>
        </div>
        <div>
          <strong>{total.toFixed(2)} €</strong>
          <span className="muted"> totali</span>
        </div>
      </div>

      <div className="libri-preview-note muted">
        Titulli, kompania, organi dhe numrat e faqes mund të plotësohen para printimit. Deskripcionet mbeten të plota dhe faqet janë të përgatitura për A4.
      </div>

      {validationIssues.length > 0 ? (
        <div className="libri-preview-warning">
          {validationIssues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </div>
      ) : (
        <div className="libri-preview-ok">Validim: faqet nuk përziejnë numra të ndryshëm.</div>
      )}

      <div className="libri-preview-grid">
        {pages.map((pageRows, pageIndex) => {
          const pageTotal = pageRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
          const pageRoot = pageRows[0]?.positionRoot || '';

          return (
            <section key={`page-${pageIndex}`} className="libri-a4-page">
              <header className="libri-a4-header">
                <div className="libri-a4-header-top">
                  <div>
                    <div className="libri-a4-kicker">{meta.company || 'Kompania'}</div>
                    <strong className="libri-a4-title">{meta.title || 'Paramasa'}</strong>
                    <div className="libri-a4-subtitle">{meta.organ || 'Organi'}</div>
                  </div>
                  <div className="libri-a4-meta-box">
                    <div><span>Nr. dokumentit</span><strong>{meta.documentNumber || '—'}</strong></div>
                    <div><span>Nr. romak</span><strong>{meta.romanNumber || '—'}</strong></div>
                    <div><span>Data</span><strong>{meta.date || '—'}</strong></div>
                  </div>
                </div>
                <div className="libri-a4-header-line" />
              </header>

              <div className="libri-a4-body">
                <div className="libri-a4-page-info">
                  <span>Faqja {pageIndex + 1}</span>
                  <span>{pageRows.length} pozicione</span>
                  <span>{pageRoot ? `Grupi ${pageRoot}.x` : 'Pa numër'}</span>
                  <strong>Totali i faqes: {pageTotal.toFixed(2)} €</strong>
                </div>

                <div className="libri-a4-table">
                  <div className="libri-a4-table-head">
                    <span>POS</span>
                    <span>Përshkrimi</span>
                    <span>Njësia</span>
                    <span>Sasia</span>
                    <span>Çmimi</span>
                    <span>TOTALI</span>
                  </div>

                  <div className="libri-a4-table-body">
                    {pageRows.map((row) => (
                      <article key={`${row.position_number}-${row.description}`} className="libri-a4-row">
                        <div className="libri-a4-pos-cell">
                          <span className={`libri-kind libri-kind-${row.positionKind}`}>{getKindLabel(row.positionKind)}</span>
                          <strong>{row.positionLabel}</strong>
                        </div>
                        <div className="libri-a4-desc-cell">{row.description}</div>
                        <div className="libri-a4-unit-cell">{row.unit || '—'}</div>
                        <div className="libri-a4-number-cell">{Number(row.quantity || 0).toFixed(2)}</div>
                        <div className="libri-a4-number-cell">{Number(row.unit_price || 0).toFixed(2)}</div>
                        <div className="libri-a4-number-cell libri-a4-total-cell">{Number(row.total_price || 0).toFixed(2)}</div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="libri-a4-footer">
                  <div className="libri-a4-signature-grid">
                    <div className="libri-a4-signature-block">
                      <span>{meta.footerLeft || 'Përgatiti'}</span>
                      <div className="libri-a4-signature-line" />
                    </div>
                    <div className="libri-a4-signature-block">
                      <span>{meta.footerMiddle || 'Kontrolloi'}</span>
                      <div className="libri-a4-signature-line" />
                    </div>
                    <div className="libri-a4-signature-block">
                      <span>{meta.footerRight || 'Miratoi'}</span>
                      <div className="libri-a4-signature-line" />
                    </div>
                  </div>
                  <div className="libri-a4-footer-note">
                    <span>Për printim A4: orientim portret, margjina të vogla, dhe faqja ruan ndarjen për nënshkrime.</span>
                  </div>
                </div>
              </div>

              <div className="libri-page-debug muted">Burimi: {groups[pageIndex]?.fileName || 'Import'} · rreshtat ndalen kur ndryshon grupi numerik për të ruajtur rendin e Excel-it.</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}