const fs = require('fs');
const path = require('path');

const outputFolder = path.join(__dirname, '..', 'output');
const inputJsonPath = path.join(outputFolder, 'libri-positions.json');
const outputHtmlPath = path.join(outputFolder, 'libri-pages.html');
const outputPagesJsonPath = path.join(outputFolder, 'libri-pages.json');

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectPositionKind(positionNumber) {
  const value = toText(positionNumber);
  if (/^\d+(?:\.\d+)*$/.test(value)) return 'numra';
  if (/^(?=[MDCLXVI]+$)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(value)) return 'romake';
  if (/^[A-Z]$/i.test(value)) return 'shkronja';
  return 'tjeter';
}

function getPositionRoot(positionNumber) {
  const match = toText(positionNumber).match(/^(\d+)/);
  return match ? match[1] : '';
}

function estimateRowHeight(row) {
  const lines = Math.max(1, Math.ceil((toText(row.description).length || 1) / 70));
  return 24 + (lines - 1) * 12;
}

function splitIntoPages(rows) {
  const pages = [];
  let current = [];
  let currentRoot = '';
  let heightUsed = 0;
  const limit = 170;

  rows.forEach((row) => {
    const rowHeight = estimateRowHeight(row);
    const nextRoot = row.positionRoot || currentRoot;
    const rootChanged = current.length > 0 && currentRoot && nextRoot && nextRoot !== currentRoot;
    const overflow = current.length > 0 && heightUsed + rowHeight > limit;

    if (rootChanged || overflow) {
      pages.push(current);
      current = [];
      currentRoot = '';
      heightUsed = 0;
    }

    current.push(row);
    heightUsed += rowHeight;
    if (!currentRoot) currentRoot = row.positionRoot || nextRoot || '';
  });

  if (current.length > 0) pages.push(current);
  return pages;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inlineValue] = arg.slice(2).split('=');
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}

function buildHtml({ meta, pages, totalRows, sourceFile }) {
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
                  .map((row) => {
                    const kind = row.positionKind || detectPositionKind(row.position_number);
                    return `
                      <article class="libri-a4-row">
                        <div class="libri-a4-pos-cell">
                          <span class="libri-kind libri-kind-${kind}">${kind === 'numra' ? 'me numra' : kind === 'romake' ? 'romake' : kind === 'shkronja' ? 'me shkronja' : 'të tjera'}</span>
                          <strong>${escapeHtml(row.position_number || '—')}</strong>
                        </div>
                        <div class="libri-a4-desc-cell">${escapeHtml(row.description)}</div>
                        <div class="libri-a4-unit-cell">${escapeHtml(row.unit || '—')}</div>
                        <div class="libri-a4-number-cell">${Number(row.quantity || 0).toFixed(2)}</div>
                        <div class="libri-a4-number-cell">${Number(row.unit_price || 0).toFixed(2)}</div>
                        <div class="libri-a4-number-cell libri-a4-total-cell">${Number(row.total_price || 0).toFixed(2)}</div>
                      </article>
                    `;
                  })
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

          <div class="libri-page-debug">Burimi: ${escapeHtml(sourceFile || 'libri-positions.json')} · grupi numerik ndalet kur ndryshon, që të mos përzihen 1.x me 2.x.</div>
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
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #eef2f7; color: #111827; }
    .wrap { padding: 16px; display: grid; gap: 16px; }
    .summary { padding: 12px 14px; background: #fff; border: 1px solid var(--border); border-radius: 12px; display: flex; flex-wrap: wrap; gap: 16px; }
    .summary strong { color: var(--primary); }
    .libri-a4-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 11mm 10mm;
      border: 1px solid var(--border);
      background: #fff;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 10px;
      page-break-after: always;
      break-after: page;
    }
    .libri-a4-header { display: grid; gap: 10px; }
    .libri-a4-header-top { display: flex; justify-content: space-between; gap: 14px; align-items: start; }
    .libri-a4-kicker { font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; }
    .libri-a4-title { display: block; font-size: 1.35rem; line-height: 1.15; color: #0f172a; margin-top: 4px; }
    .libri-a4-subtitle { margin-top: 6px; font-size: 0.9rem; color: #334155; }
    .libri-a4-meta-box { display: grid; gap: 6px; min-width: 190px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 14px; background: #f8fafc; }
    .libri-a4-meta-box div { display: flex; justify-content: space-between; gap: 10px; font-size: 0.85rem; }
    .libri-a4-meta-box span { color: #64748b; }
    .libri-a4-meta-box strong { color: #0f172a; }
    .libri-a4-header-line { border-top: 2px solid #0f172a; }
    .libri-a4-body { display: grid; gap: 10px; }
    .libri-a4-page-info { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 0.85rem; color: #334155; }
    .libri-a4-table { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
    .libri-a4-table-head, .libri-a4-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 70px 78px 82px 82px; }
    .libri-a4-table-head { background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; }
    .libri-a4-table-head span { padding: 9px 8px; border-right: 1px solid #e2e8f0; }
    .libri-a4-table-head span:last-child { border-right: 0; }
    .libri-a4-row { border-bottom: 1px solid #e2e8f0; font-size: 0.86rem; }
    .libri-a4-row:last-child { border-bottom: 0; }
    .libri-a4-row > div { padding: 9px 8px; border-right: 1px solid #e2e8f0; }
    .libri-a4-row > div:last-child { border-right: 0; }
    .libri-a4-pos-cell { display: grid; gap: 4px; align-content: start; }
    .libri-kind { display: inline-flex; width: fit-content; padding: 3px 7px; border-radius: 999px; font-size: 0.67rem; font-weight: 800; text-transform: uppercase; }
    .libri-kind-numra { background: #dcfce7; color: #166534; }
    .libri-kind-romake { background: #dbeafe; color: #1d4ed8; }
    .libri-kind-shkronja { background: #fef3c7; color: #92400e; }
    .libri-kind-tjeter { background: #e2e8f0; color: #334155; }
    .libri-a4-desc-cell { line-height: 1.35; white-space: normal; word-break: break-word; }
    .libri-a4-unit-cell, .libri-a4-number-cell { display: flex; align-items: start; }
    .libri-a4-number-cell { justify-content: flex-end; font-variant-numeric: tabular-nums; }
    .libri-a4-total-cell { font-weight: 800; }
    .libri-a4-footer { display: grid; gap: 10px; }
    .libri-a4-signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .libri-a4-signature-block { display: grid; gap: 22px; }
    .libri-a4-signature-block span { font-size: 0.8rem; color: #334155; }
    .libri-a4-signature-line { border-bottom: 1px solid #0f172a; min-height: 20px; }
    .libri-a4-footer-note, .libri-page-debug { font-size: 0.76rem; color: #475569; }
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

function main() {
  if (!fs.existsSync(inputJsonPath)) {
    console.error('Missing input JSON:', inputJsonPath);
    process.exit(1);
  }

  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const parsed = JSON.parse(fs.readFileSync(inputJsonPath, 'utf8'));
  const rows = Array.isArray(parsed.positions) ? parsed.positions : [];
  const meta = parseArgs(process.argv.slice(2));

  const normalizedRows = rows.map((row) => ({
    ...row,
    positionKind: row.positionKind || detectPositionKind(row.positionNumber || row.position_number),
    positionLabel: row.positionNumber || row.position_number || '',
    positionRoot: row.positionRoot || getPositionRoot(row.positionNumber || row.position_number),
    position_number: row.positionNumber || row.position_number || '',
    description: row.description || '',
    unit: row.unit || '',
    quantity: Number(row.quantity ?? 0),
    unit_price: Number(row.unitPrice ?? row.unit_price ?? 0),
    total_price: Number(row.total ?? row.total_price ?? 0),
  }));

  const pages = splitIntoPages(normalizedRows);
  const html = buildHtml({
    meta,
    pages,
    totalRows: normalizedRows.length,
    sourceFile: path.basename(inputJsonPath),
  });

  fs.writeFileSync(outputHtmlPath, html, 'utf8');
  fs.writeFileSync(outputPagesJsonPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: inputJsonPath,
    pageCount: pages.length,
    pages: pages.map((pageRows, index) => ({
      index: index + 1,
      root: pageRows[0]?.positionRoot || '',
      rowCount: pageRows.length,
      total: pageRows.reduce((sum, row) => sum + Number(row.total_price || 0), 0),
      positions: pageRows,
    })),
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    outputHtmlPath,
    outputPagesJsonPath,
    pageCount: pages.length,
    rowCount: normalizedRows.length,
  }, null, 2));
}

main();