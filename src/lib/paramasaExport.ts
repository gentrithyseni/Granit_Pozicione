import type { ParsedRow } from './excel';
import { getRowIndentLevel, getSectionLabel, groupRowsBySection, splitParamasaPages, type ParamasaTemplateMode } from './paramasaPreview';
import type { ParamasaPreviewMeta } from '../components/ParamasaPreview';

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(meta: ParamasaPreviewMeta, rows: ParsedRow[], pageNumber: number, templateMode: ParamasaTemplateMode, sectionLabel: string, sectionIndex: number): string {
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
  const pages = splitParamasaPages(rows, templateMode);
  const content = pages.map((page, index) => `
    <section class="libri-a4-page paramasa-final-page">
      <header class="libri-a4-header">
        <div class="libri-a4-header-top">
          <div>
            <div class="libri-a4-kicker">${escapeHtml(meta.executorName || 'Kryesi i punes')}</div>
            <strong class="libri-a4-title">${escapeHtml(meta.objectName || 'Objekti')}</strong>
            <div class="libri-a4-subtitle">${escapeHtml(meta.sectionTitle || 'Paramasa')} · ${escapeHtml(sectionLabel)}</div>
          </div>
          <div class="libri-a4-meta-box">
            <div><span>Kryesi i punes</span><strong>${escapeHtml(meta.executorName || '—')}</strong></div>
            <div><span>Muaji / Data</span><strong>${escapeHtml(meta.month || '—')} / ${escapeHtml(meta.date || '—')}</strong></div>
            <div><span>Llogaria me oferte</span><strong>${escapeHtml(meta.offerAccount || '—')}</strong></div>
          </div>
        </div>
        <div class="libri-a4-header-line"></div>
      </header>

      <div class="libri-a4-body">
        <div class="libri-a4-page-info">
          <span>Faqja ${sectionIndex + 1}.${page.pageNumber}</span>
          <span>${page.rows.length} pozicione</span>
          <span>Final</span>
          <strong>Totali i faqes: ${page.rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0).toFixed(2)} €</strong>
        </div>

        <div class="libri-a4-table paramasa-final-table">
          <div class="libri-a4-table-head paramasa-final-table-head">
            <span>Poz.</span>
            <span>Përshkrimi</span>
            <span>Njësia</span>
            <span>Sasia</span>
            <span>Gjithsej</span>
          </div>
          <div class="libri-a4-table-body">
            ${page.rows.map((row) => `
              <article class="libri-a4-row paramasa-final-row">
                <div class="libri-a4-pos-cell">
                  <span class="libri-kind libri-kind-numra">${escapeHtml(getSectionLabel(row.position_number))}</span>
                  <strong>${escapeHtml(row.position_number || '—')}</strong>
                </div>
                <div class="libri-a4-desc-cell" style="padding-left: ${getRowIndentLevel(row.position_number) * 10}px">${escapeHtml(row.description)}</div>
                <div class="libri-a4-unit-cell">${escapeHtml(row.unit || '—')}</div>
                <div class="libri-a4-number-cell">${Number(row.quantity || 0).toFixed(2)}</div>
                <div class="libri-a4-number-cell libri-a4-total-cell">${Number(row.total_price || 0).toFixed(2)}</div>
              </article>
            `).join('')}
          </div>
        </div>

        <div class="libri-a4-footer">
          <div class="libri-a4-signature-grid">
            <div class="libri-a4-signature-block"><span>Përgatiti</span><div class="libri-a4-signature-line"></div></div>
            <div class="libri-a4-signature-block"><span>Kontrolloi</span><div class="libri-a4-signature-line"></div></div>
            <div class="libri-a4-signature-block"><span>Miratoi</span><div class="libri-a4-signature-line"></div></div>
          </div>
          <div class="libri-a4-footer-note">
            <span>${escapeHtml(meta.offerPositions || 'Pozicionet vendosen automatikisht nga sistemi')}</span>
            <strong>${escapeHtml(meta.offerAccount || '—')}</strong>
          </div>
        </div>
      </div>
    </section>
  `).join('');

  return content;
}

export function buildParamasaFinalHtml(rows: ParsedRow[], meta: ParamasaPreviewMeta, templateMode: ParamasaTemplateMode): string {
  const sections = groupRowsBySection(rows);
  const total = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);

  const body = sections
    .map((section, index) => renderPage(meta, section.rows, index + 1, templateMode, section.sectionLabel, index))
    .join('\n');

  return `<!doctype html>
<html lang="sq">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Paramasa Final</title>
  <style>
    body { margin: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; background: #eef2f7; color: #111827; }
    .wrap { display: grid; gap: 18px; padding: 18px; }
    .summary { padding: 12px 14px; background: #fff; border: 1px solid #7f7f7f; display: flex; flex-wrap: wrap; gap: 18px; }
    .summary strong { color: #059669; }
    .libri-a4-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 8mm 8mm 10mm; border: 1px solid #7f7f7f; background: #fff; display: grid; grid-template-rows: auto 1fr auto; gap: 10px; page-break-after: always; break-after: page; }
    .libri-a4-header { display: grid; gap: 10px; }
    .libri-a4-header-top { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
    .libri-a4-kicker { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #4b5563; }
    .libri-a4-title { display: block; font-size: 16px; line-height: 1.1; color: #111827; margin-top: 2px; font-weight: 700; }
    .libri-a4-subtitle { margin-top: 4px; font-size: 11px; color: #374151; }
    .libri-a4-meta-box { display: grid; gap: 4px; min-width: 188px; padding: 8px 10px; border: 1px solid #7f7f7f; background: rgba(255,255,255,0.96); }
    .libri-a4-meta-box div { display: flex; justify-content: space-between; gap: 10px; font-size: 10.5px; border-bottom: 1px solid #d9d9d9; padding-bottom: 2px; }
    .libri-a4-meta-box div:last-child { border-bottom: 0; padding-bottom: 0; }
    .libri-a4-meta-box span { color: #4b5563; }
    .libri-a4-header-line { border-top: 1px solid #111827; margin-top: 2px; }
    .libri-a4-body { display: grid; gap: 10px; }
    .libri-a4-page-info { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 10.5px; color: #374151; }
    .libri-a4-table { border: 1px solid #111827; overflow: hidden; }
    .libri-a4-table-head, .libri-a4-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 70px 78px 82px; }
    .libri-a4-table-head { background: #fafafa; border-bottom: 1px solid #111827; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .libri-a4-table-head span { padding: 6px 7px; border-right: 1px solid #111827; }
    .libri-a4-table-head span:last-child { border-right: 0; }
    .libri-a4-row { border-bottom: 1px solid #bfbfbf; font-size: 11px; }
    .libri-a4-row:last-child { border-bottom: 0; }
    .libri-a4-row > div { padding: 6px 7px; border-right: 1px solid #bfbfbf; }
    .libri-a4-row > div:last-child { border-right: 0; }
    .libri-a4-pos-cell { display: grid; gap: 2px; align-content: start; }
    .libri-kind { display: inline-flex; width: fit-content; padding: 1px 5px; font-size: 9px; font-weight: 700; text-transform: uppercase; border: 1px solid #111827; background: #fff; color: #111827; }
    .libri-a4-desc-cell { line-height: 1.22; word-break: break-word; }
    .libri-a4-unit-cell, .libri-a4-number-cell { display: flex; align-items: start; }
    .libri-a4-number-cell { justify-content: flex-end; font-variant-numeric: tabular-nums; }
    .libri-a4-total-cell { font-weight: 800; }
    .libri-a4-footer { display: grid; gap: 8px; padding-top: 2px; }
    .libri-a4-signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .libri-a4-signature-block { display: grid; gap: 18px; }
    .libri-a4-signature-line { border-bottom: 1px solid #111827; min-height: 16px; }
    .libri-a4-footer-note { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; color: #4b5563; }
    @page { size: A4; margin: 8mm; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="summary">
      <div><strong>${rows.length}</strong> pozicione</div>
      <div><strong>${sections.length}</strong> seksione</div>
      <div><strong>${total.toFixed(2)} €</strong> total</div>
      <div><strong>${escapeHtml(meta.objectName || 'Paramasa')}</strong></div>
    </div>
    ${body}
  </div>
</body>
</html>`;
}
