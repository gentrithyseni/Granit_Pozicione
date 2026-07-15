import ExcelJS from 'exceljs';
import type { FaturaKind, FaturaKontrateFields, FaturaPozicioneFields, FaturaPositionRow } from '../types/fatura';
import { downloadWorkbookBuffer } from './libriExport';

const TEMPLATE_URLS: Record<FaturaKind, string> = {
  kontrate: '/templates/Fatura-Shabllon-Kontrate.xlsx',
  pozicione: '/templates/Fletedergese-Shabllon-Pozicione.xlsx',
};

const KONTRATE_TITLE_ROWS = [30, 31, 32, 33, 34, 35] as const;
const KONTRATE_REFERENCE_ROWS = [30, 31, 32, 33, 34, 35] as const;
const POZICIONE_FIRST_ROW = 25;
const POZICIONE_TEMPLATE_ROWS = 4;
const POZICIONE_TOTAL_ROW_BASE = 29;

const PEACH_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFABF8F' },
};

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null): void {
  ws.getCell(row, col).value = value ?? '';
}

function splitLines(text: string, maxLines: number): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  while (lines.length < maxLines) lines.push('');
  return lines.slice(0, maxLines);
}

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function applyA4PrintSetup(ws: ExcelJS.Worksheet): void {
  const lastRow = ws.dimensions?.bottom || ws.rowCount || 44;
  const lastCol = ws.dimensions?.right || ws.columnCount || 10;
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
  try {
    ws.unMergeCells(range);
  } catch {
    // range nuk ishte i bashkuar
  }
}

function applyBoxBorder(
  ws: ExcelJS.Worksheet,
  topRow: number,
  bottomRow: number,
  leftCol: number,
  rightCol: number,
  fill?: ExcelJS.Fill
): void {
  const medium: ExcelJS.BorderStyle = 'medium';
  for (let row = topRow; row <= bottomRow; row += 1) {
    for (let col = leftCol; col <= rightCol; col += 1) {
      const cell = ws.getCell(row, col);
      if (fill) cell.fill = fill;
      cell.border = {
        top: row === topRow ? { style: medium } : cell.border?.top,
        bottom: row === bottomRow ? { style: medium } : cell.border?.bottom,
        left: col === leftCol ? { style: medium } : cell.border?.left,
        right: col === rightCol ? { style: medium } : cell.border?.right,
      };
    }
  }
}

async function loadTemplateWorkbook(kind: FaturaKind): Promise<ExcelJS.Workbook> {
  const response = await fetch(TEMPLATE_URLS[kind]);
  if (!response.ok) throw new Error(`Nuk u gjet shablloni i faturës (${kind}).`);
  const buffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function buildKontrateContractBlock(data: FaturaKontrateFields): string {
  const contractLine = [
    'Numri i kontratës :',
    data.contractBlockNumber,
    data.contractBlockDate ? `dt  ${data.contractBlockDate}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const lines = [
    contractLine,
    data.contractBlockTitle ? `Titulli :  ${data.contractBlockTitle}` : '',
    data.contractProtocolReference
      ? `Referenca e protokollit të kontratës: ${data.contractProtocolReference}`
      : '',
    data.contractWorkSiteAddress ? `Adresa e vendit te kryerjes së punëve :  ${data.contractWorkSiteAddress}` : '',
    data.invoiceDate ? `Datën e faturës : ${data.invoiceDate}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function applyKontrateLayoutStyles(ws: ExcelJS.Worksheet, data: FaturaKontrateFields): void {
  applyBoxBorder(ws, 11, 16, 8, 10, PEACH_FILL);

  safeUnmerge(ws, 'H12:J13');
  ws.mergeCells('H12:J13');
  const clientCell = ws.getCell('H12');
  clientCell.value = [data.clientName, data.clientNameLine2].filter(Boolean).join('\n');
  clientCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  clientCell.font = { name: 'Cambria', size: 20, bold: true };
  clientCell.fill = PEACH_FILL;

  safeUnmerge(ws, 'H16:J16');
  ws.mergeCells('H16:J16');
  const addressCell = ws.getCell('H16');
  addressCell.value = ` Adresa  : ${data.clientAddress}`;
  addressCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  addressCell.font = { name: 'Cambria', size: 11, bold: true };
  addressCell.fill = PEACH_FILL;

  const perLabel = ws.getCell('H11');
  perLabel.alignment = { horizontal: 'left', vertical: 'middle' };
  perLabel.font = { name: 'Cambria', size: 14, bold: true };
  perLabel.fill = PEACH_FILL;

  const bankCell = ws.getCell('A16');
  bankCell.font = { name: 'Cambria', size: 14, bold: true };

  const contractCell = ws.getCell('A19');
  contractCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  contractCell.font = { name: 'Arial', size: 12, bold: true };
}

function fillKontrateWorksheet(ws: ExcelJS.Worksheet, data: FaturaKontrateFields): void {
  setCell(ws, 9, 1, `   FATURA Nr = ${data.invoiceNumber}`);
  setCell(ws, 9, 10, `              Data: ${data.invoiceDate}      `);

  setCell(ws, 12, 1, data.issuer.companyName);
  setCell(ws, 14, 1, `Nr.unik identifikues:${data.issuer.nui}`);
  setCell(ws, 16, 1, `NLB BANKA:  ${data.issuer.bankAccount}`);

  setCell(ws, 19, 1, buildKontrateContractBlock(data));

  const titleLines = splitLines(data.tableTitle, KONTRATE_TITLE_ROWS.length);
  KONTRATE_TITLE_ROWS.forEach((row, index) => setCell(ws, row, 1, titleLines[index]));

  setCell(ws, 30, 4, data.tableContractNumber);

  const referenceLines = splitLines(data.tableInvoiceReference, KONTRATE_REFERENCE_ROWS.length);
  KONTRATE_REFERENCE_ROWS.forEach((row, index) => setCell(ws, row, 6, referenceLines[index]));

  const total = parseNumber(data.totalWithVat);
  if (total !== null) {
    setCell(ws, 31, 10, total);
  } else {
    setCell(ws, 31, 10, '');
  }
  ws.getCell(31, 8).value = { formula: 'J31/1.18' };
  ws.getCell(31, 9).value = { formula: 'J31-H31' };

  applyKontrateLayoutStyles(ws, data);
  applyA4PrintSetup(ws);
}

function cloneRowStyle(ws: ExcelJS.Worksheet, sourceRow: number, targetRow: number, lastCol: number): void {
  const source = ws.getRow(sourceRow);
  const target = ws.getRow(targetRow);
  target.height = source.height;
  for (let col = 1; col <= lastCol; col += 1) {
    const sourceCell = source.getCell(col);
    const targetCell = target.getCell(col);
    if (sourceCell.style) targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
    if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;
  }
}

function mergePozicioneDataRow(ws: ExcelJS.Worksheet, row: number): void {
  try {
    ws.mergeCells(`A${row}:B${row}`);
    ws.mergeCells(`C${row}:F${row}`);
  } catch {
    // range tashmë i bashkuar ose i pavlefshëm
  }
}

function applyPozicioneLayoutStyles(ws: ExcelJS.Worksheet, data: FaturaPozicioneFields): void {
  applyBoxBorder(ws, 12, 17, 7, 10, PEACH_FILL);

  safeUnmerge(ws, 'G14:J15');
  ws.mergeCells('G14:J15');
  const clientCell = ws.getCell('G14');
  clientCell.value = [data.clientName, data.clientNameLine2].filter(Boolean).join('\n');
  clientCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  clientCell.font = { name: 'Cambria', size: 18, bold: true };
  clientCell.fill = PEACH_FILL;

  safeUnmerge(ws, 'G17:J17');
  ws.mergeCells('G17:J17');
  const addressCell = ws.getCell('G17');
  addressCell.value = `Adresa  :  ${data.clientAddress}`;
  addressCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  addressCell.font = { name: 'Cambria', size: 11, bold: true };
  addressCell.fill = PEACH_FILL;

  const perLabel = ws.getCell('G12');
  perLabel.font = { name: 'Cambria', size: 14, bold: true };
  perLabel.fill = PEACH_FILL;

  const bankCell = ws.getCell('A17');
  bankCell.font = { name: 'Cambria', size: 14, bold: true };
}

function fillPozicioneWorksheet(ws: ExcelJS.Worksheet, data: FaturaPozicioneFields): void {
  setCell(ws, 10, 1, `FATURA Nr = ${data.invoiceNumber}`);
  setCell(ws, 9, 10, `${data.place},`);
  setCell(ws, 10, 10, data.invoiceDate);

  setCell(ws, 13, 1, data.issuer.companyName);
  setCell(ws, 15, 1, `Nr.unik identifikues:${data.issuer.nui}`);
  setCell(ws, 17, 1, `NLB BANKA:  ${data.issuer.bankAccount}`);

  const contractLine = [data.contractTitle, data.contractNumber ? `Numri i kontratës: ${data.contractNumber}` : '']
    .filter(Boolean)
    .join('   ');
  setCell(ws, 20, 1, contractLine ? ` ${contractLine}` : '');

  const positions = data.positions.filter((row) =>
    row.description.trim() || row.unit.trim() || row.quantity.trim() || row.unitPrice.trim()
  );
  const rowsNeeded = Math.max(positions.length, 1);
  const extraRows = Math.max(0, rowsNeeded - POZICIONE_TEMPLATE_ROWS);

  if (extraRows > 0) {
    ws.spliceRows(POZICIONE_TOTAL_ROW_BASE, 0, ...Array.from({ length: extraRows }, () => []));
    for (let i = 0; i < extraRows; i += 1) {
      const targetRow = POZICIONE_FIRST_ROW + POZICIONE_TEMPLATE_ROWS + i;
      cloneRowStyle(ws, POZICIONE_FIRST_ROW, targetRow, 10);
      mergePozicioneDataRow(ws, targetRow);
    }
  }

  const totalRow = POZICIONE_TOTAL_ROW_BASE + extraRows;
  const lastDataRow = POZICIONE_FIRST_ROW + Math.max(positions.length, POZICIONE_TEMPLATE_ROWS) - 1;

  for (let index = POZICIONE_FIRST_ROW; index <= lastDataRow; index += 1) {
    setCell(ws, index, 1, '');
    setCell(ws, index, 3, '');
    setCell(ws, index, 7, '');
    setCell(ws, index, 8, '');
    setCell(ws, index, 9, '');
    setCell(ws, index, 10, '');
  }

  positions.forEach((position, index) => {
    fillPozicioneRow(ws, POZICIONE_FIRST_ROW + index, index + 1, position);
  });

  ws.getCell(totalRow, 10).value = {
    formula: `SUM(J${POZICIONE_FIRST_ROW}:J${Math.max(POZICIONE_FIRST_ROW + positions.length - 1, POZICIONE_FIRST_ROW)})`,
  };

  applyPozicioneLayoutStyles(ws, data);
  applyA4PrintSetup(ws);
}

function fillPozicioneRow(ws: ExcelJS.Worksheet, row: number, articleNo: number, position: FaturaPositionRow): void {
  setCell(ws, row, 1, articleNo);
  setCell(ws, row, 3, position.description);
  setCell(ws, row, 7, position.unit);

  const quantity = parseNumber(position.quantity);
  const unitPrice = parseNumber(position.unitPrice);
  setCell(ws, row, 8, quantity ?? '');
  setCell(ws, row, 9, unitPrice ?? '');

  if (quantity !== null && unitPrice !== null) {
    ws.getCell(row, 10).value = { formula: `(H${row}*I${row})` };
  } else {
    setCell(ws, row, 10, '');
  }
}

export async function buildKontrateWorkbook(data: FaturaKontrateFields): Promise<ArrayBuffer> {
  const workbook = await loadTemplateWorkbook('kontrate');
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Shablloni i kontratës nuk ka asnjë fletë.');
  fillKontrateWorksheet(sheet, data);
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function buildPozicioneWorkbook(data: FaturaPozicioneFields): Promise<ArrayBuffer> {
  const workbook = await loadTemplateWorkbook('pozicione');
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Shablloni i pozicioneve nuk ka asnjë fletë.');
  fillPozicioneWorksheet(sheet, data);
  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function downloadKontrateInvoice(data: FaturaKontrateFields): Promise<void> {
  return buildKontrateWorkbook(data).then((buffer) => {
    const safeNumber = data.invoiceNumber.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'fature';
    downloadWorkbookBuffer(buffer, `Fatura-Kontrate-${safeNumber}.xlsx`);
  });
}

export function downloadPozicioneInvoice(data: FaturaPozicioneFields): Promise<void> {
  return buildPozicioneWorkbook(data).then((buffer) => {
    const safeNumber = data.invoiceNumber.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'flete-dergese';
    downloadWorkbookBuffer(buffer, `Flete-Dergese-${safeNumber}.xlsx`);
  });
}
