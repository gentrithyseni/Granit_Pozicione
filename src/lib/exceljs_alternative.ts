/**
 * ALTERNATIVË ME EXCELJS
 * 
 * Nëse xlsx (v0.18.5) nuk e mbështet stilizimin e plotë (borders, colors),
 * përdor këtë version me exceljs.
 * 
 * Instalimi:
 *   npm install exceljs
 *   npm install -D @types/exceljs
 * 
 * Përdorimi është identik me constructionBook.ts:
 *   import { generateAndDownload } from './exceljs_alternative';
 *   generateAndDownload(config, 'filename.xlsx');
 */

import ExcelJS from 'exceljs';

export interface ConstructionBookPosition {
  position_number: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ConstructionBookConfig {
  month: string;
  executor_name: string;
  building_name: string;
  section_title: string;
  section_number: string;
  unit_label: string;
  offer_account: string;
  offer_positions: string;
  positions: ConstructionBookPosition[];
  max_positions_per_page?: number;
}

function splitIntoPages(positions: ConstructionBookPosition[], maxPerPage: number = 4): ConstructionBookPosition[][] {
  const pages: ConstructionBookPosition[][] = [];
  let currentPage: ConstructionBookPosition[] = [];
  let currentEstimatedRows = 0;
  const MAX_ROWS_PER_PAGE = 22;
  const ROWS_PER_POSITION_BASE = 4;

  for (const pos of positions) {
    const descRows = Math.ceil(pos.description.length / 90);
    const posRows = Math.max(ROWS_PER_POSITION_BASE, descRows + 2);

    if (currentPage.length > 0 && (currentEstimatedRows + posRows > MAX_ROWS_PER_PAGE || currentPage.length >= maxPerPage)) {
      pages.push(currentPage);
      currentPage = [pos];
      currentEstimatedRows = posRows;
    } else {
      currentPage.push(pos);
      currentEstimatedRows += posRows;
    }
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}

function generatePageWorksheet(
  workbook: ExcelJS.Workbook,
  pagePositions: ConstructionBookPosition[],
  config: ConstructionBookConfig,
  pageIndex: number,
  totalPages: number
): void {
  const sheetName = totalPages === 1 ? 'Libri Ndërtimor' : `Faqja ${pageIndex + 1}`;
  const ws = workbook.addWorksheet(sheetName);

  // Gjerësia e kolonave
  ws.columns = [
    { width: 18 },  // A
    { width: 12 },  // B
    { width: 22 },  // C
    { width: 16 },  // D
    { width: 16 }   // E
  ];

  let row = 1;

  // Helper për të shtuar rresht me merge
  function addMergedRow(r: number, values: (string | number)[], mergeStart: number = 0, mergeEnd: number = 4, opts: any = {}) {
    const excelRow = ws.getRow(r);
    values.forEach((val, idx) => {
      const cell = excelRow.getCell(idx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: opts.fontSize || 11, bold: opts.bold || false, italic: opts.italic || false };
      cell.alignment = { horizontal: opts.align || 'left', vertical: 'top', wrapText: opts.wrap || false };
      if (opts.border) {
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      }
    });
    if (mergeStart < mergeEnd) {
      ws.mergeCells(r, mergeStart + 1, r, mergeEnd + 1);
    }
  }

  // Header
  addMergedRow(row++, ['', '', '', `Muaji-Month ${config.month}`, ''], 3, 4, { bold: true, align: 'center' });
  addMergedRow(row++, ['', '', '', `Muaji-Month ${config.month}`, ''], 3, 4, { bold: true, align: 'center' });
  addMergedRow(row++, [`Kryerësi i punëve "${config.executor_name}"`, '', '', '', ''], 0, 4, { bold: true });

  const row4 = ws.getRow(row++);
  row4.getCell(1).value = 'Executor of the works';
  row4.getCell(1).font = { italic: true };
  row4.getCell(4).value = `Objekti-Building : ${config.building_name}`;
  row4.getCell(4).font = { bold: true };
  ws.mergeCells(row - 1, 4, row - 1, 5);

  addMergedRow(row++, ['Libri ndërtimor - Construction book', '', '', '', ''], 0, 4, { bold: true });
  row++; // zbrazir

  // Titujt
  const row7 = ws.getRow(row++);
  row7.getCell(1).value = 'Pozicioni i punës - Working positions';
  row7.getCell(1).font = { bold: true };
  row7.getCell(4).value = 'Llogaria me  ofertë';
  row7.getCell(4).alignment = { horizontal: 'center' };
  row7.getCell(5).value = 'Poz. Me ofertë';
  row7.getCell(5).alignment = { horizontal: 'center' };

  const row8 = ws.getRow(row++);
  row8.getCell(1).value = config.section_title;
  row8.getCell(1).font = { bold: true };
  row8.getCell(4).value = 'Account with offer';
  row8.getCell(4).alignment = { horizontal: 'center' };
  row8.getCell(5).value = 'Position whith offer';
  row8.getCell(5).alignment = { horizontal: 'center' };

  const row9 = ws.getRow(row++);
  row9.getCell(4).value = config.offer_account;
  row9.getCell(4).alignment = { horizontal: 'center' };
  row9.getCell(5).value = config.offer_positions;
  row9.getCell(5).alignment = { horizontal: 'center' };

  const row10 = ws.getRow(row++);
  row10.getCell(1).value = 'Njësia matëse €';
  row10.getCell(1).font = { bold: true };
  row10.getCell(4).value = `Masa         ${config.unit_label}`;
  row10.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells(row - 1, 4, row - 1, 5);

  const row11 = ws.getRow(row++);
  row11.getCell(1).value = 'Unit of measurement  €     EURO';
  row11.getCell(1).font = { italic: true };
  row11.getCell(4).value = 'me - with     €';
  row11.getCell(4).alignment = { horizontal: 'center' };
  ws.mergeCells(row - 1, 4, row - 1, 5);

  // Header i tabelës
  const headerRow = ws.getRow(row++);
  const headers = ['A =', 'B =', 'A+B', 'Mujore-Monthly', 'Gjithsejtë - Total'];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  // Pozicionet
  for (const pos of pagePositions) {
    const descRow = ws.getRow(row++);
    descRow.getCell(1).value = `${pos.position_number} ${pos.description}`;
    descRow.getCell(1).alignment = { vertical: 'top', wrapText: true };
    descRow.getCell(1).border = {
      top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'none' }, right: { style: 'none' }
    };
    ws.mergeCells(row - 1, 1, row - 1, 5);

    const calcRow = ws.getRow(row++);
    calcRow.getCell(3).value = `${pos.quantity.toFixed(2)} x ${pos.unit_price.toFixed(2)}  = ${pos.total_price.toFixed(2)}`;
    calcRow.getCell(3).alignment = { horizontal: 'right' };
    calcRow.getCell(3).border = { bottom: { style: 'thin' } };
    calcRow.getCell(4).value = pos.quantity;
    calcRow.getCell(4).alignment = { horizontal: 'center' };
    calcRow.getCell(4).border = { bottom: { style: 'thin' } };

    const totalRow = ws.getRow(row++);
    totalRow.getCell(3).value = 'Gjithsejt :';
    totalRow.getCell(3).alignment = { horizontal: 'right' };
    totalRow.getCell(3).border = { bottom: { style: 'thin' } };
    totalRow.getCell(5).value = pos.quantity;
    totalRow.getCell(5).alignment = { horizontal: 'center' };
    totalRow.getCell(5).border = { bottom: { style: 'thin' } };

    row++; // zbrazir
  }

  // Footer
  if (pageIndex < totalPages - 1) {
    const fbRow1 = ws.getRow(row++);
    fbRow1.getCell(1).value = 'Për bartje.';
    fbRow1.getCell(1).font = { italic: true };

    const fbRow2 = ws.getRow(row++);
    fbRow2.getCell(1).value = 'it continuous in the';
    fbRow2.getCell(1).font = { italic: true };

    const fbRow3 = ws.getRow(row++);
    fbRow3.getCell(1).value = 'other sheet';
    fbRow3.getCell(1).font = { italic: true };
  }

  row++; // zbrazir

  const signRow = ws.getRow(row++);
  signRow.getCell(1).value = 'Kryesi i punëve : __________________';
  signRow.getCell(1).font = { bold: true };
  signRow.getCell(4).value = 'Organi mbikqyrës:            ________________';
  signRow.getCell(4).font = { bold: true };
  ws.mergeCells(row - 1, 4, row - 1, 5);
}

export async function generateConstructionBook(config: ConstructionBookConfig): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const pages = splitIntoPages(config.positions, config.max_positions_per_page || 4);

  pages.forEach((pagePositions, index) => {
    generatePageWorksheet(workbook, pagePositions, config, index, pages.length);
  });

  return workbook;
}

export async function downloadConstructionBook(workbook: ExcelJS.Workbook, filename: string = 'Libri_Ndertimor.xlsx'): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateAndDownload(config: ConstructionBookConfig, filename?: string): Promise<void> {
  const workbook = await generateConstructionBook(config);
  await downloadConstructionBook(workbook, filename);
}