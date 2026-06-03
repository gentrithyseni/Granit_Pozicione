import type { ParsedRow } from './excel';
import {
  enhanceRows,
  getKindLabel,
  splitIntoPages,
  type LibriBookRow,
  type LibriPreviewMeta,
} from './libriPages';

type PageExport = {
  index: number;
  root: string;
  rowCount: number;
  total: number;
  positions: LibriBookRow[];
};

export type LibriExportPayload = {
  html: string;
  json: string;
  pageCount: number;
  rowCount: number;
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: unknown): string {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(meta: LibriPreviewMeta, pages: LibriBookRow[][], totalRows: number): string {
  const pageMarkup = pages
    .map((pageRows, pageIndex) => {
      const pageTotal = pageRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
      const pageRoot = pageRows[0]?.positionRoot || '';

      return `
        <section class="libri-a4-page">
          <header class="libri-a4-header">
            <div class="libri-a4-header-top">
              <div>
                <div class="libri-a4-kicker">${escapeHtml(meta.company || 'Kompania')}</div>
                <strong class="libri-a4-title">${escapeHtml(meta.title || 'Paramasa për librin ndërtimor')}</strong>
                <div class="libri-a4-subtitle">${escapeHtml(meta.organ || 'Organi')}</div>
              </div>
              <div class="libri-a4-meta-box">
                <div><span>Nr. dokumentit</span><strong>${escapeHtml(meta.documentNumber || '—')}</strong></div>
                <div><span>Nr. romak</span><strong>${escapeHtml(meta.romanNumber || '—')}</strong></div>
                <div><span>Data</span><strong>${escapeHtml(meta.date || '—')}</strong></div>
              </div>
            </div>
            <div class="libri-a4-header-line"></div>
          </header>

          <div class="libri-a4-body">
            <div class="libri-a4-page-info">
              <span>Faqja ${pageIndex + 1}</span>
              <span>${pageRows.length} pozicione</span>
              <span>${pageRoot ? `Grupi ${escapeHtml(pageRoot)}.x` : 'Pa numër'}</span>
              <strong>Totali i faqes: ${pageTotal.toFixed(2)} €</strong>
            </div>

            <div class="libri-a4-table">
              <div class="libri-a4-table-head">
                <span>POS</span>
                <span>Përshkrimi</span>
                <span>Njësia</span>
                <span>Sasia</span>
                <span>Çmimi</span>
                <span>TOTALI</span>
              </div>
              <div class="libri-a4-table-body">
                ${pageRows
                  .map((row) => `
                    <article class="libri-a4-row">
                      <div class="libri-a4-pos-cell">
                        <span class="libri-kind libri-kind-${row.positionKind}">${getKindLabel(row.positionKind)}</span>
                        <strong>${escapeHtml(row.positionLabel)}</strong>
                      </div>
                      <div class="libri-a4-desc-cell">${escapeHtml(row.description)}</div>
                      <div class="libri-a4-unit-cell">${escapeHtml(row.unit || '—')}</div>
                      <div class="libri-a4-number-cell">${Number(row.quantity || 0).toFixed(2)}</div>
                      <div class="libri-a4-number-cell">${Number(row.unit_price || 0).toFixed(2)}</div>
                      <div class="libri-a4-number-cell libri-a4-total-cell">${Number(row.total_price || 0).toFixed(2)}</div>
                    </article>
                  `)
                  .join('')}
              </div>
            </div>

            <div class="libri-a4-footer">
              <div class="libri-a4-signature-grid">
                <div class="libri-a4-signature-block"><span>${escapeHtml(meta.footerLeft || 'Përgatiti')}</span><div class="libri-a4-signature-line"></div></div>
                <div class="libri-a4-signature-block"><span>${escapeHtml(meta.footerMiddle || 'Kontrolloi')}</span><div class="libri-a4-signature-line"></div></div>
                <div class="libri-a4-signature-block"><span>${escapeHtml(meta.footerRight || 'Miratoi')}</span><div class="libri-a4-signature-line"></div></div>
              </div>
              <div class="libri-a4-footer-note">
                <span>Për printim A4: orientim portret, margjina të vogla, dhe faqja ruan ndarjen për nënshkrime.</span>
              </div>
            </div>
          </div>

          <div class="libri-page-debug">Burimi: eksport nga aplikacioni · grupi numerik ndalet kur ndryshon, që të mos përzihen 1.x me 2.x.</div>
        </section>
      `;
    })
    .join('\n');

  return `<!doctype html>
<html lang="sq">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Libri Pages Export</title>
  <style>
    :root { --border: #cbd5e1; --primary: #059669; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; background: #eef2f7; color: #111827; font-size: 11px; }
    .wrap { padding: 16px; display: grid; gap: 16px; }
    .summary { padding: 10px 12px; background: #fff; border: 1px solid #7f7f7f; border-radius: 0; display: flex; flex-wrap: wrap; gap: 16px; }
    .summary strong { color: var(--primary); }
    .libri-a4-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 8mm 10mm; border: 1px solid #7f7f7f; border-radius: 0; background: #fff; display: grid; grid-template-rows: auto 1fr auto; gap: 10px; page-break-after: always; break-after: page; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11px; overflow: hidden; }
    .libri-a4-header { display: grid; gap: 10px; }
    .libri-a4-header-top { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
    .libri-a4-kicker { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #4b5563; }
    .libri-a4-title { display: block; font-size: 16px; line-height: 1.1; color: #111827; margin-top: 2px; font-weight: 700; }
    .libri-a4-subtitle { margin-top: 4px; font-size: 11px; color: #374151; }
    .libri-a4-meta-box { display: grid; gap: 4px; min-width: 188px; padding: 8px 10px; border: 1px solid #7f7f7f; border-radius: 0; background: rgba(255, 255, 255, 0.96); }
    .libri-a4-meta-box div { display: flex; justify-content: space-between; gap: 10px; font-size: 10.5px; border-bottom: 1px solid #d9d9d9; padding-bottom: 2px; }
    .libri-a4-meta-box div:last-child { border-bottom: 0; padding-bottom: 0; }
    .libri-a4-meta-box span { color: #4b5563; }
    .libri-a4-meta-box strong { color: #111827; }
    .libri-a4-header-line { border-top: 1px solid #111827; margin-top: 2px; }
    .libri-a4-body { display: grid; gap: 10px; }
    .libri-a4-page-info { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 10.5px; color: #374151; }
    .libri-a4-table { border: 1px solid #111827; border-radius: 0; overflow: hidden; background: rgba(255, 255, 255, 0.95); }
    .libri-a4-table-head, .libri-a4-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 70px 78px 82px 82px; }
    .libri-a4-table-head { background: #fafafa; border-bottom: 1px solid #111827; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .libri-a4-table-head span { padding: 6px 7px; border-right: 1px solid #111827; }
    .libri-a4-table-head span:last-child { border-right: 0; }
    .libri-a4-row { border-bottom: 1px solid #bfbfbf; font-size: 11px; }
    .libri-a4-row:last-child { border-bottom: 0; }
    .libri-a4-row > div { padding: 6px 7px; border-right: 1px solid #bfbfbf; }
    .libri-a4-row > div:last-child { border-right: 0; }
    .libri-a4-pos-cell { display: grid; gap: 2px; align-content: start; }
    .libri-kind { display: inline-flex; width: fit-content; padding: 1px 5px; border-radius: 0; font-size: 9px; font-weight: 700; text-transform: uppercase; border: 1px solid #111827; background: #fff; color: #111827; }
    .libri-kind-numra, .libri-kind-romake, .libri-kind-shkronja, .libri-kind-tjeter { background: #fff; color: #111827; }
    .libri-a4-desc-cell { line-height: 1.22; white-space: normal; word-break: break-word; }
    .libri-a4-unit-cell, .libri-a4-number-cell { display: flex; align-items: start; }
    .libri-a4-number-cell { justify-content: flex-end; font-variant-numeric: tabular-nums; }
    .libri-a4-total-cell { font-weight: 800; }
    .libri-a4-footer { display: grid; gap: 8px; padding-top: 2px; }
    .libri-a4-signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .libri-a4-signature-block { display: grid; gap: 18px; }
    .libri-a4-signature-block span { font-size: 10px; color: #374151; }
    .libri-a4-signature-line { border-bottom: 1px solid #111827; min-height: 16px; }
    .libri-a4-footer-note, .libri-page-debug { font-size: 10px; color: #4b5563; }
    @page { size: A4; margin: 8mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="summary">
      <div><strong>${totalRows}</strong> pozicione</div>
      <div><strong>${pages.length}</strong> faqe A4</div>
      <div><strong>${escapeHtml(meta.title || 'Paramasa për librin ndërtimor')}</strong></div>
    </div>
    ${pageMarkup}
  </div>
</body>
</html>`;
}

export function createLibriExport(rows: ParsedRow[], meta: LibriPreviewMeta): LibriExportPayload {
  const enhancedRows = enhanceRows(rows);
  const pages = splitIntoPages(enhancedRows);
  const pageData: PageExport[] = pages.map((pageRows, index) => ({
    index: index + 1,
    root: pageRows[0]?.positionRoot || '',
    rowCount: pageRows.length,
    total: pageRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0),
    positions: pageRows,
  }));

  return {
    html: buildHtml(meta, pages, enhancedRows.length),
    json: JSON.stringify({
      generatedAt: new Date().toISOString(),
      pageCount: pageData.length,
      rows: enhancedRows.length,
      pages: pageData,
    }, null, 2),
    pageCount: pageData.length,
    rowCount: enhancedRows.length,
  };
}