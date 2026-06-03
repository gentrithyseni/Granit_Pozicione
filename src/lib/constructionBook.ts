import * as XLSX from 'xlsx';

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

// Stilet bazë për qelizat - përdorim border të hollë (thin) si në formatin origjinal
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } }
};

const NO_BORDER = {
  top: { style: 'none' },
  bottom: { style: 'none' },
  left: { style: 'none' },
  right: { style: 'none' }
};

const BOTTOM_BORDER = {
  top: { style: 'none' },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'none' },
  right: { style: 'none' }
};

const TOP_BOTTOM_BORDER = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'none' },
  right: { style: 'none' }
};

function createCell(value: string | number, opts: {
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'center' | 'bottom';
  wrap?: boolean;
  border?: 'thin' | 'none' | 'bottom' | 'top-bottom';
} = {}): XLSX.CellObject {
  const cell: XLSX.CellObject = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: {
      font: {
        name: 'Calibri',
        sz: opts.fontSize || 11,
        bold: opts.bold || false,
        italic: opts.italic || false,
        color: { rgb: '000000' }
      },
      alignment: {
        horizontal: opts.align || 'left',
        vertical: opts.valign || 'top',
        wrapText: opts.wrap || false,
        readingOrder: 2
      },
      border: opts.border === 'thin' ? THIN_BORDER :
              opts.border === 'bottom' ? BOTTOM_BORDER :
              opts.border === 'top-bottom' ? TOP_BOTTOM_BORDER :
              NO_BORDER
    }
  };
  return cell;
}

function emptyCell(): XLSX.CellObject {
  return createCell('', {});
}

/**
 * Ndarja e pozicioneve në faqe
 * Rregull: max 5 pozicione, min 1. Përshkrimet e gjata zvogëlojnë numrin.
 */
function splitIntoPages(positions: ConstructionBookPosition[], maxPerPage: number = 4): ConstructionBookPosition[][] {
  const pages: ConstructionBookPosition[][] = [];
  let currentPage: ConstructionBookPosition[] = [];
  let currentEstimatedRows = 0;

  // Header + footer zënë rreth 18 rreshta. Le të mbajmë ~22 rreshta për pozicione.
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

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Gjeneron një faqe të vetme të librit ndërtimor
 */
function generatePageSheet(
  pagePositions: ConstructionBookPosition[],
  config: ConstructionBookConfig,
  pageIndex: number,
  totalPages: number
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  // Gjerësia e kolonave (në karaktere) - e njëjta me formatin origjinal
  ws['!cols'] = [
    { wch: 18 },  // A
    { wch: 12 },  // B
    { wch: 22 },  // C
    { wch: 16 },  // D
    { wch: 16 }   // E
  ];

  let row = 1;

  // ===== HEADER =====
  // Rreshti 1-2: Muaji (dy herë, si në formatin origjinal)
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(`Muaji-Month ${config.month}`, { bold: true, align: 'center' });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(`Muaji-Month ${config.month}`, { bold: true, align: 'center' });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 3: Kryerësi i punëve
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell(`Kryerësi i punëve "${config.executor_name}"`, { bold: true });
  merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 4: Executor + Objekti
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Executor of the works', { italic: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(`Objekti-Building : ${config.building_name}`, { bold: true });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 5: Libri ndërtimor
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Libri ndërtimor - Construction book', { bold: true });
  merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 6: Zbrazir
  row++;

  // Rreshti 7: Pozicioni i punës / Llogaria / Pozicioni
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Pozicioni i punës - Working positions', { bold: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell('Llogaria me  ofertë', { align: 'center' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = createCell('Poz. Me ofertë', { align: 'center' });
  row++;

  // Rreshti 8: Titulli i seksionit + Account with offer
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell(config.section_title, { bold: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell('Account with offer', { align: 'center' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = createCell('Position whith offer', { align: 'center' });
  row++;

  // Rreshti 9: Numri i ofertës
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(config.offer_account, { align: 'center' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = createCell(config.offer_positions, { align: 'center' });
  row++;

  // Rreshti 10: Njësia matëse
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell(`Njësia matëse €`, { bold: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(`Masa         ${config.unit_label}`, { align: 'center' });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 11: Unit of measurement
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Unit of measurement  €     EURO', { italic: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell('me - with     €', { align: 'center' });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  // Rreshti 12: Header i tabelës (A=, B=, A+B, Mujore, Gjithsejtë)
  const headerRow = row;
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('A =', { bold: true, align: 'center', border: 'thin' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 1 })] = createCell('B =', { bold: true, align: 'center', border: 'thin' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 2 })] = createCell('A+B', { bold: true, align: 'center', border: 'thin' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell('Mujore-Monthly', { bold: true, align: 'center', border: 'thin' });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = createCell('Gjithsejtë - Total', { bold: true, align: 'center', border: 'thin' });
  row++;

  // ===== POZICIONET =====
  for (const pos of pagePositions) {
    // Rreshti i përshkrimit (spanon të 5 kolonat)
    const descText = `${pos.position_number} ${pos.description}`;
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell(descText, { 
      wrap: true, 
      border: 'top-bottom',
      valign: 'top'
    });
    merges.push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 4 } });
    row++;

    // Rreshti i kalkulimit
    const calcText = `${pos.quantity.toFixed(2)} x ${pos.unit_price.toFixed(2)}  = ${pos.total_price.toFixed(2)}`;
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 2 })] = createCell(calcText, { align: 'right', border: 'bottom' });
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell(pos.quantity, { align: 'center', border: 'bottom' });
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = emptyCell();
    row++;

    // Rreshti "Gjithsej"
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 2 })] = createCell('Gjithsejt :', { align: 'right', border: 'bottom' });
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = emptyCell();
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 4 })] = createCell(pos.quantity, { align: 'center', border: 'bottom' });
    row++;

    // Rresht zbrazirë mes pozicioneve
    row++;
  }

  // ===== FOOTER =====
  if (pageIndex < totalPages - 1) {
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Për bartje.', { italic: true });
    row++;
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('it continuous in the', { italic: true });
    row++;
    ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('other sheet', { italic: true });
    row++;
  }

  // Rresht zbrazirë para nënshkrimeve
  row++;

  // Nënshkrimet
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })] = createCell('Kryesi i punëve : __________________', { bold: true });
  ws[XLSX.utils.encode_cell({ r: row - 1, c: 3 })] = createCell('Organi mbikqyrës:            ________________', { bold: true });
  merges.push({ s: { r: row - 1, c: 3 }, e: { r: row - 1, c: 4 } });
  row++;

  // Cakto dimensionet e worksheet
  ws['!merges'] = merges;
  ws['!ref'] = `A1:E${row}`;
  ws['!autofilter'] = { ref: `A${headerRow}:E${headerRow}` };

  return ws;
}

/**
 * Gjeneron workbook-in e plotë të Librit Ndërtimor
 */
export function generateConstructionBook(config: ConstructionBookConfig): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const pages = splitIntoPages(config.positions, config.max_positions_per_page || 4);

  pages.forEach((pagePositions, index) => {
    const ws = generatePageSheet(pagePositions, config, index, pages.length);
    const sheetName = pages.length === 1 ? 'Libri Ndërtimor' : `Faqja ${index + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  return wb;
}

/**
 * Shkarkon workbook-in si file Excel
 */
export function downloadConstructionBook(wb: XLSX.WorkBook, filename: string = 'Libri_Ndertimor.xlsx'): void {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gjeneron dhe shkarkon direkt
 */
export function generateAndDownload(config: ConstructionBookConfig, filename?: string): void {
  const wb = generateConstructionBook(config);
  downloadConstructionBook(wb, filename);
}