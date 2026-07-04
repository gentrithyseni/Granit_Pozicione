import * as XLSX from 'xlsx';
import { isLibriNdertimorSheet, parseLibriSheet, type LibriMeasurementLine, type LibriMeta } from './libriNdertimor';

export type ParsedRow = {
  position_number: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sheet_name?: string;
  issues?: string[];
  /** I pranishëm vetëm kur rreshti vjen nga formati "Libri Ndërtimor" (Shablloni-Faqe). */
  measurements?: LibriMeasurementLine[];
  /** Meta i librit ndërtimor (kryesi, muaji, objekti, seksioni...) kur burimi është ai format. */
  libriMeta?: LibriMeta;
  source?: 'paramasa' | 'libri';
};

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function rowText(row: unknown[]): string {
  return row.map(toCellText).filter(Boolean).join(' | ');
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => toCellText(cell) === '');
}

function isSignatureRow(row: unknown[]): boolean {
  const text = normalizeString(rowText(row));
  return text.includes('kryesi i pun') || text.includes('organi mbikqyr') || text.includes('signature');
}

function isStructuredHeaderRow(row: unknown[]): boolean {
  const first = normalizeString(toCellText(row[0]));
  const second = normalizeString(toCellText(row[1]));
  const third = normalizeString(toCellText(row[2]));
  const fourth = normalizeString(toCellText(row[3]));
  const fifth = normalizeString(toCellText(row[4]));
  const sixth = normalizeString(toCellText(row[5]));

  return (
    first === 'pos' &&
    second.includes('pershkrimi i pozicionit') &&
    third.includes('njesia') &&
    fourth.includes('sasia') &&
    fifth.includes('cmimi') &&
    (sixth.includes('shuma') || sixth.includes('gjithsej'))
  );
}

function extractPositionNumber(text: string): string {
  const match = String(text || '').match(/^\s*([0-9]+(?:\.[0-9]+)*)\b/);
  return match ? match[1] : '';
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStructuredRows(rows: unknown[][], sheetName: string): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  let active = false;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];

    if (isStructuredHeaderRow(row)) {
      active = true;
      continue;
    }

    if (!active) continue;
    if (isSignatureRow(row)) break;
    if (isEmptyRow(row)) continue;

    const positionNumber = extractPositionNumber(toCellText(row[0]));
    const description = toCellText(row[1]);
    if (!positionNumber || !description || normalizeString(description).startsWith('gjithsejt')) {
      continue;
    }

    const quantity = parseNumeric(row[3]);
    const unitPrice = parseNumeric(row[4]);
    const explicitTotal = parseNumeric(row[5]);
    const totalPrice = explicitTotal || quantity * unitPrice;

    parsed.push({
      position_number: positionNumber,
      description,
      unit: toCellText(row[2]),
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      sheet_name: sheetName,
      issues: [],
    });
  }

  return parsed;
}

function parseLegacyRows(rows: unknown[][], sheetName: string): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  let headerMap: Record<string, number> | null = null;

  for (const row of rows) {
    if (!headerMap) {
      const tempMap: Record<string, number> = {};
      let matchCount = 0;

      row.forEach((cell, key) => {
        const val = normalizeString(toCellText(cell));
        if (val.includes('nr') || val.includes('numri') || val === 'pos' || val.includes('poz')) {
          tempMap.position = Number(key);
          matchCount += 1;
        } else if (val.includes('pershkrim') || val.includes('emertimi') || val.includes('punet')) {
          tempMap.description = Number(key);
          matchCount += 1;
        } else if (val.includes('njesi')) {
          tempMap.unit = Number(key);
          matchCount += 1;
        } else if (val.includes('sasi')) {
          tempMap.quantity = Number(key);
          matchCount += 1;
        } else if (val.includes('cmim') && !val.includes('total')) {
          tempMap.price = Number(key);
          matchCount += 1;
        }
      });

      if (matchCount >= 3) {
        headerMap = tempMap;
      }
      continue;
    }

    const description = toCellText(row[headerMap.description as number]);
    if (!description || normalizeString(description).startsWith('gjithsejt')) continue;

    const quantity = parseNumeric(row[headerMap.quantity as number]);
    const unitPrice = parseNumeric(row[headerMap.price as number]);
    if (quantity <= 0) continue;

    const positionNumber = toCellText(row[headerMap.position as number] ?? '');
    parsed.push({
      position_number: positionNumber,
      description,
      unit: toCellText(row[headerMap.unit as number] ?? 'copë'),
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
      sheet_name: sheetName,
      issues: [],
    });
  }

  return parsed;
}

function libriPositionsToRows(sheetName: string, meta: LibriMeta, positions: ReturnType<typeof parseLibriSheet>['positions']): ParsedRow[] {
  return positions.map((position) => ({
    position_number: position.positionNumber,
    description: position.description,
    unit: position.unit,
    quantity: position.quantity,
    unit_price: 0,
    total_price: 0,
    sheet_name: sheetName,
    issues: ['Nga Libri Ndërtimor: çmimi nuk vjen nga ky skedar, duhet plotësuar/kombinuar manualisht.'],
    measurements: position.measurements,
    libriMeta: meta,
    source: 'libri',
  }));
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedRow[] {
  const rows: ParsedRow[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });

    if (isLibriNdertimorSheet(jsonData)) {
      const { meta, positions } = parseLibriSheet(jsonData, sheetName);
      if (positions.length > 0) {
        rows.push(...libriPositionsToRows(sheetName, meta, positions).map((row) => ({ ...row, source: 'libri' as const })));
        return;
      }
    }

    const structuredRows = parseStructuredRows(jsonData, sheetName);
    if (structuredRows.length > 0) {
      rows.push(...structuredRows.map((row) => ({ ...row, source: 'paramasa' as const })));
      return;
    }

    rows.push(...parseLegacyRows(jsonData, sheetName).map((row) => ({ ...row, source: 'paramasa' as const })));
  });

  return rows;
}

export async function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(parseWorkbook(workbook));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
