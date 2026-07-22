import ExcelJS from 'exceljs';
import type { FaturaKind, FaturaKontrateFields, FaturaPozicioneFields, FaturaPositionRow } from '../types/fatura';
import { downloadWorkbookBuffer } from './libriExport';

const TEMPLATE_URLS: Record<FaturaKind, string> = {
  kontrate: '/templates/Fatura - Shabllon - Kontrate.xlsx',
  pozicione: '/templates/Fletedergese-Shabllon-Pozicione.xlsx',
};

// ── Kontratë ─────────────────────────────────────────────────────────────────
// Koordinata të verifikuara drejtpërdrejt nga shablloni real (python/openpyxl):
//   A30:C36  → titulli i kontratës (NJË qelizë e bashkuar me wrapText)
//   D30:E31  → numri i kontratës
//   F30:G36  → referenca e faturës  (NJË qelizë e bashkuar me wrapText)
//   H31/I31/J31 → formulas vlera pa TVSH / TVSH / me TVSH
//   A19:J20  → blloku i kontratës (wrapText, lartësi 77pt)
//   H12:K14  → emri i klientit
//   H16:J16  → adresa e klientit
const K = {
  invoiceNumRow: 9, invoiceNumCol: 1,   // A9
  invoiceDateCol: 10,                   // J9
  issuerNameRow: 12, issuerNameCol: 1,  // A12
  issuerNuiRow: 14, issuerNuiCol: 1,   // A14
  issuerBankRow: 16, issuerBankCol: 1, // A16
  contractBlockRow: 19,                 // A19:J20 (merged)
  clientNameCell: 'H12',               // H12:K14 (merged)
  clientAddressCell: 'H16',            // H16:J16 (merged)
  perCell: 'H11',
  titleCell: 'A30',    // A30:C36 — NJË qelizë e bashkuar
  contractNumCell: 'D30',  // D30:E31 — NJË qelizë e bashkuar
  refCell: 'F30',      // F30:G36 — NJË qelizë e bashkuar
  totalRow: 31,        // H31 pa TVSH, I31 TVSH, J31 me TVSH
};

// ── Fletëdërgesë ──────────────────────────────────────────────────────────────
// merged (nga inspektimi): A10:E10, A13:E13, A15:E15, A17:E17, A19:I19,
//   A20:I21, A23:B24..A29:B29, C23:F24..C29:F29, G14:J14..G17:J17 etj.
const P = {
  placeCol: 10, placeRow: 9,           // J9
  invoiceNumRow: 10, invoiceNumCol: 1, // A10 (merged A10:E10)
  invoiceDateRow: 10, invoiceDateCol: 10, // J10
  issuerNameRow: 13, issuerNameCol: 1, // A13
  issuerNuiRow: 15, issuerNuiCol: 1,  // A15
  issuerBankRow: 17, issuerBankCol: 1,// A17
  contractRow: 20, contractCol: 1,    // A20 (merged A20:I21)
  clientNameCell: 'G14',              // G14:J15 (merged)
  clientAddressCell: 'G17',          // G17:J17 (merged)
  perCell: 'G12',
  firstDataRow: 25,                   // rreshti i parë (25, jo 23 — 23-24 janë header)
  templateDataRows: 4,                // 23..29 = 7 rreshta
  totalRow: 30,                       // totali (pas spliceRows nëse ka shtesë)
};

const PEACH_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFABF8F' },
};

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null): void {
  ws.getCell(row, col).value = value ?? '';
}

function parseNumber(value: string): number | null {
  const n = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && value.trim() !== '' ? n : null;
}

function applyA4PrintSetup(ws: ExcelJS.Worksheet): void {
  const lastRow = ws.dimensions?.bottom || ws.rowCount || 44;
  const lastCol = ws.dimensions?.right || ws.columnCount || 11;
  const lastColLetter = String.fromCharCode(64 + Math.min(lastCol, 26));
  ws.pageSetup = {
    ...ws.pageSetup,
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: `A1:${lastColLetter}${lastRow}`,
  };
}

function safeUnmerge(ws: ExcelJS.Worksheet, range: string): void {
  try { ws.unMergeCells(range); } catch { /* jo i bashkuar */ }
}

async function loadTemplate(kind: FaturaKind): Promise<ExcelJS.Workbook> {
  const res = await fetch(TEMPLATE_URLS[kind]);
  if (!res.ok) throw new Error(`Shablloni "${kind}" nuk u gjet (${res.status}).`);
  const buf = await res.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

// ── Kontratë: fill ────────────────────────────────────────────────────────────
function fillKontrate(ws: ExcelJS.Worksheet, d: FaturaKontrateFields): void {
  // Rreshti 9: numri + data
  setCell(ws, K.invoiceNumRow, K.invoiceNumCol, `   FATURA Nr = ${d.invoiceNumber}`);
  setCell(ws, K.invoiceNumRow, K.invoiceDateCol, `              Data: ${d.invoiceDate}      `);

  // Lëshuesi
  setCell(ws, K.issuerNameRow, K.issuerNameCol, d.issuer.companyName);
  setCell(ws, K.issuerNuiRow,  K.issuerNuiCol,  `Nr.unik identifikues:${d.issuer.nui}`);
  setCell(ws, K.issuerBankRow, K.issuerBankCol, `NLB BANKA:  ${d.issuer.bankAccount}`);

  // Blloku i kontratës — A19:J20, wrapText, e tëra si tekst i vetëm
  const contractBlock = [
    d.contractBlockNumber ? `Numri i kontratës : ${d.contractBlockNumber}${d.contractBlockDate ? `  dt  ${d.contractBlockDate}` : ''}` : '',
    d.contractBlockTitle ? `Titulli :  ${d.contractBlockTitle}` : '',
    d.contractProtocolReference ? `Referenca e protokollit të kontratës: ${d.contractProtocolReference}` : '',
    d.contractWorkSiteAddress ? `Adresa e vendit të kryerjes së punëve :  ${d.contractWorkSiteAddress}` : '',
    d.invoiceDate ? `Datën e faturës : ${d.invoiceDate}` : '',
  ].filter(Boolean).join('\n');
  const contractCell = ws.getCell(K.contractBlockRow, 1);
  contractCell.value = contractBlock;
  contractCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  contractCell.font = { name: 'Arial', size: 12, bold: true };

  // Tabela (rreshtat 27-28 janë header, s'preken)
  // A30:C36 — NJË qelizë e bashkuar me wrapText — shkruan titulli i kontratës
  const titleCell = ws.getCell(K.titleCell);
  titleCell.value = d.tableTitle;
  titleCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  titleCell.font = { name: 'Cambria', size: 11 };

  // D30:E31 — NJË qelizë e bashkuar — numri i kontratës
  const contractNumCell = ws.getCell(K.contractNumCell);
  contractNumCell.value = d.tableContractNumber;
  contractNumCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  contractNumCell.font = { name: 'Cambria', size: 9 };

  // F30:G36 — NJË qelizë e bashkuar me wrapText — referenca
  const refCell = ws.getCell(K.refCell);
  refCell.value = d.tableInvoiceReference;
  refCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  refCell.font = { name: 'Cambria', size: 10 };

  // Totalet H31/I31/J31
  const total = parseNumber(d.totalWithVat);
  if (total !== null) {
    setCell(ws, K.totalRow, 10, total);
  } else {
    setCell(ws, K.totalRow, 10, '');
  }
  ws.getCell(K.totalRow, 8).value = { formula: `J${K.totalRow}/1.18` };
  ws.getCell(K.totalRow, 9).value = { formula: `J${K.totalRow}-H${K.totalRow}` };

  // H12:K14 — klienti (safeUnmerge+mergeCells ruan master cell por mund t'i heqë bordet)
  safeUnmerge(ws, 'H12:K14');
  ws.mergeCells('H12:K14');
  const clientCell = ws.getCell(K.clientNameCell);
  clientCell.value = [d.clientName, d.clientNameLine2].filter(Boolean).join('\n');
  clientCell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true, shrinkToFit: false };
  clientCell.font = { name: 'Cambria', size: 18, bold: true };
  clientCell.fill = PEACH_FILL;
  // Restauro bordet medium nga shablloni (H11:T=medium, H12:L=medium, K12:R=medium, H16:B=medium...)
  const medium: ExcelJS.BorderStyle = 'medium';
  clientCell.border = { top: { style: medium }, left: { style: medium }, right: { style: medium } };

  // H16:J16 — adresa
  safeUnmerge(ws, 'H16:J16');
  ws.mergeCells('H16:J16');
  const addressCell = ws.getCell(K.clientAddressCell);
  addressCell.value = ` Adresa  : ${d.clientAddress}`;
  addressCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  addressCell.font = { name: 'Cambria', size: 11, bold: true };
  addressCell.fill = PEACH_FILL;
  addressCell.border = { bottom: { style: medium }, left: { style: medium }, right: { style: medium } };

  // "PËR" label
  const perLabel = ws.getCell(K.perCell);
  perLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  perLabel.font = { name: 'Cambria', size: 14, bold: true };
  perLabel.fill = PEACH_FILL;

  ws.getCell('A16').font = { name: 'Cambria', size: 14, bold: true };

  applyA4PrintSetup(ws);
}

// ── Fletëdërgesë: fill ───────────────────────────────────────────────────────
function cloneRowStyle(ws: ExcelJS.Worksheet, src: number, tgt: number, cols: number): void {
  const source = ws.getRow(src);
  const target = ws.getRow(tgt);
  target.height = source.height;
  for (let c = 1; c <= cols; c++) {
    const sc = source.getCell(c);
    const tc = target.getCell(c);
    if (sc.style) tc.style = JSON.parse(JSON.stringify(sc.style));
    if (sc.numFmt) tc.numFmt = sc.numFmt;
  }
}

function fillPozicioneRow(ws: ExcelJS.Worksheet, row: number, nr: number, pos: FaturaPositionRow): void {
  setCell(ws, row, 1, nr);
  setCell(ws, row, 3, pos.description);
  setCell(ws, row, 7, pos.unit);
  const qty = parseNumber(pos.quantity);
  const price = parseNumber(pos.unitPrice);
  setCell(ws, row, 8, qty ?? '');
  setCell(ws, row, 9, price ?? '');
  if (qty !== null && price !== null) {
    ws.getCell(row, 10).value = { formula: `H${row}*I${row}` };
  } else {
    setCell(ws, row, 10, '');
  }
}

function fillPozicione(ws: ExcelJS.Worksheet, d: FaturaPozicioneFields): void {
  setCell(ws, P.placeRow,       P.placeCol,        `${d.place},`);
  setCell(ws, P.invoiceNumRow,  P.invoiceNumCol,   `FATURA Nr = ${d.invoiceNumber}`);
  setCell(ws, P.invoiceDateRow, P.invoiceDateCol,  d.invoiceDate);
  setCell(ws, P.issuerNameRow,  P.issuerNameCol,   d.issuer.companyName);
  setCell(ws, P.issuerNuiRow,   P.issuerNuiCol,    `Nr.unik identifikues:${d.issuer.nui}`);
  setCell(ws, P.issuerBankRow,  P.issuerBankCol,   `NLB BANKA:  ${d.issuer.bankAccount}`);

  const contractLine = [
    d.contractTitle,
    d.contractNumber ? `Numri i kontratës: ${d.contractNumber}` : '',
  ].filter(Boolean).join('   ');
  setCell(ws, P.contractRow, P.contractCol, contractLine ? ` ${contractLine}` : '');
  const contractCell = ws.getCell(P.contractRow, P.contractCol);
  contractCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

  const positions = d.positions.filter(p =>
    p.description.trim() || p.unit.trim() || p.quantity.trim() || p.unitPrice.trim()
  );
  const extra = Math.max(0, positions.length - P.templateDataRows);

  if (extra > 0) {
    ws.spliceRows(P.totalRow, 0, ...Array.from({ length: extra }, () => []));
    for (let i = 0; i < extra; i++) {
      const tgt = P.firstDataRow + P.templateDataRows + i;
      cloneRowStyle(ws, P.firstDataRow, tgt, 10);
      try { ws.mergeCells(`A${tgt}:B${tgt}`); } catch {}
      try { ws.mergeCells(`C${tgt}:F${tgt}`); } catch {}
    }
  }

  const totalRow = P.totalRow + extra;
  const lastData = P.firstDataRow + Math.max(positions.length, P.templateDataRows) - 1;

  // Pastro rreshtat e të dhënave
  for (let r = P.firstDataRow; r <= lastData; r++) {
    for (const c of [1, 3, 7, 8, 9, 10]) setCell(ws, r, c, '');
  }

  positions.forEach((pos, i) => fillPozicioneRow(ws, P.firstDataRow + i, i + 1, pos));

  ws.getCell(totalRow, 10).value = {
    formula: `SUM(J${P.firstDataRow}:J${Math.max(P.firstDataRow + positions.length - 1, P.firstDataRow)})`,
  };

  // Klienti G14:J15 — restauro bordet medium pas merge
  safeUnmerge(ws, 'G14:J15');
  ws.mergeCells('G14:J15');
  const clientCell = ws.getCell(P.clientNameCell);
  clientCell.value = [d.clientName, d.clientNameLine2].filter(Boolean).join('\n');
  clientCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  clientCell.font = { name: 'Cambria', size: 18, bold: true };
  clientCell.fill = PEACH_FILL;
  const mediumP: ExcelJS.BorderStyle = 'medium';
  clientCell.border = { top: { style: mediumP }, left: { style: mediumP }, right: { style: mediumP } };

  // Adresa G17:J17 — restauro bordet medium
  safeUnmerge(ws, 'G17:J17');
  ws.mergeCells('G17:J17');
  const addressCell = ws.getCell(P.clientAddressCell);
  addressCell.value = `Adresa  :  ${d.clientAddress}`;
  addressCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  addressCell.font = { name: 'Cambria', size: 11, bold: true };
  addressCell.fill = PEACH_FILL;
  addressCell.border = { bottom: { style: mediumP }, left: { style: mediumP }, right: { style: mediumP } };

  const perLabel = ws.getCell(P.perCell);
  perLabel.font = { name: 'Cambria', size: 14, bold: true };
  perLabel.fill = PEACH_FILL;

  ws.getCell('A17').font = { name: 'Cambria', size: 14, bold: true };

  applyA4PrintSetup(ws);
}

// ── Exports ──────────────────────────────────────────────────────────────────
export async function buildKontrateWorkbook(data: FaturaKontrateFields): Promise<ArrayBuffer> {
  const wb = await loadTemplate('kontrate');
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Shablloni i kontratës nuk ka asnjë fletë.');
  fillKontrate(ws, data);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function buildPozicioneWorkbook(data: FaturaPozicioneFields): Promise<ArrayBuffer> {
  const wb = await loadTemplate('pozicione');
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Shablloni i pozicioneve nuk ka asnjë fletë.');
  fillPozicione(ws, data);
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function downloadKontrateInvoice(data: FaturaKontrateFields): Promise<void> {
  return buildKontrateWorkbook(data).then((buf) => {
    const safe = data.invoiceNumber.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'fature';
    downloadWorkbookBuffer(buf, `Fatura-Kontrate-${safe}.xlsx`);
  });
}

export function downloadPozicioneInvoice(data: FaturaPozicioneFields): Promise<void> {
  return buildPozicioneWorkbook(data).then((buf) => {
    const safe = data.invoiceNumber.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'flete-dergese';
    downloadWorkbookBuffer(buf, `Flete-Dergese-${safe}.xlsx`);
  });
}