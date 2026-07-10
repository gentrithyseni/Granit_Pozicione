import type { ParsedRow } from './excel';

export type ParamasaTemplateId = 1 | 2 | 3 | 4 | 5;
export type ParamasaTemplateMode = ParamasaTemplateId | 'auto';

export type ParamasaPage = {
  pageNumber: number;
  templateId: ParamasaTemplateId;
  rows: ParsedRow[];
};

export type ParamasaSection = {
  sectionKey: string;
  sectionLabel: string;
  rows: ParsedRow[];
};

export const PARAMASA_TEMPLATES: Array<{ id: ParamasaTemplateId; label: string; maxRows: number; hint: string }> = [
  { id: 1, label: 'Shablloni-1 Faqe', maxRows: 1, hint: '1 pozicion për faqe' },
  { id: 2, label: 'Shablloni-2 Faqe', maxRows: 2, hint: '2 pozicione për faqe' },
  { id: 3, label: 'Shablloni-3 Faqe', maxRows: 3, hint: '3 pozicione për faqe' },
  { id: 4, label: 'Shablloni-4 Faqe', maxRows: 4, hint: '4 pozicione për faqe' },
  { id: 5, label: 'Shablloni-5 Faqe', maxRows: 5, hint: '5 pozicione për faqe' },
];

const PAGE_UNIT_LIMIT = 94;

function normalizePositionToken(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

function getPositionRoot(positionNumber: string): string {
  const normalized = normalizePositionToken(positionNumber);
  if (!normalized) return '';
  const match = normalized.match(/^([IVXLCDM]+|\d+)(?:[\.]\d+)*$/i);
  if (match) return match[1].toUpperCase();
  const firstPart = normalized.split('.')[0] || normalized;
  return firstPart.toUpperCase();
}

function isRomanRoot(value: string): boolean {
  return /^(?=[MDCLXVI]+$)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(value);
}

function isNumericRoot(value: string): boolean {
  return /^\d+$/.test(value);
}

export function getSectionLabel(positionNumber: string): string {
  const root = getPositionRoot(positionNumber);
  return root ? `${root}.` : '—';
}

export function getRowIndentLevel(positionNumber: string): number {
  const normalized = normalizePositionToken(positionNumber);
  if (!normalized) return 0;
  return normalized.split('.').length - 1;
}

/** Një rresht "2 INSTALIMI I KANALIZIMIT" (numër pozicioni pa pikë, dhe çmim 0) s'është pozicion
 * i vërtetë — është titull seksioni i ngulitur brenda vetë paramasës. E njohim dhe e nxjerrim si
 * titull, në vend që ta trajtojmë si pozicion me "0.00 x 1.00 = 0.00" (siç raportoi përdoruesi). */
function isSectionHeaderRow(row: ParsedRow): boolean {
  const normalized = normalizePositionToken(row.position_number);
  if (!normalized || normalized.includes('.')) return false;
  const qty = Number(row.quantity || 0);
  const unitPrice = Number(row.unit_price || 0);
  const totalPrice = Number(row.total_price || 0);
  return qty === 0 && unitPrice === 0 && totalPrice === 0 && Boolean(String(row.description || '').trim());
}

export function groupRowsBySection(rows: ParsedRow[]): ParamasaSection[] {
  const sections = new Map<string, ParamasaSection>();

  rows.forEach((row) => {
    const root = getPositionRoot(row.position_number);
    // Prioritet: titulli real i seksionit (kapur nga rreshti me numër romak në vetë skedarin),
    // sepse vetëm numri i pozicionit mund të mos përputhet me seksionin real — paramasa reale
    // shpesh kanë numërtim jo-konsistent (p.sh. pozicion "4.1" i vendosur gabimisht nën
    // seksionin III në vend të IV). Titulli real e rregullon këtë automatikisht.
    const sectionKey = row.section_title || root || row.position_number || 'unknown';

    let existing = sections.get(sectionKey);
    if (!existing) {
      existing = {
        sectionKey,
        sectionLabel: row.section_title || (isRomanRoot(sectionKey) || isNumericRoot(sectionKey) ? `${sectionKey}.` : sectionKey),
        rows: [],
      };
      sections.set(sectionKey, existing);
    }

    if (isSectionHeaderRow(row)) {
      const description = String(row.description || '').trim();
      if (description && !existing.sectionLabel.includes(description)) {
        existing.sectionLabel = `${getPositionRoot(row.position_number)}. ${description}`;
      }
      return; // titull, jo pozicion — s'shkon te existing.rows, s'zë vend faqeje
    }

    existing.rows.push(row);
  });

  return Array.from(sections.values()).filter((section) => section.rows.length > 0);
}

function estimateRowUnits(row: ParsedRow): number {
  const descriptionLength = String(row.description || '').trim().length;
  const descriptionUnits = Math.max(1, Math.ceil(descriptionLength / 58));
  return 12 + descriptionUnits * 6;
}

function fitsWithinPage(rows: ParsedRow[]): boolean {
  return rows.reduce((sum, row) => sum + estimateRowUnits(row), 0) <= PAGE_UNIT_LIMIT;
}

function chooseAutoTemplate(rows: ParsedRow[]): ParamasaTemplateId {
  const upperBound = Math.min(5, rows.length) as ParamasaTemplateId;
  for (let size = upperBound; size >= 1; size -= 1) {
    const candidate = rows.slice(0, size);
    if (candidate.length === size && fitsWithinPage(candidate)) {
      return size as ParamasaTemplateId;
    }
  }

  return 1;
}

export function splitParamasaPages(rows: ParsedRow[], mode: ParamasaTemplateMode): ParamasaPage[] {
  const pages: ParamasaPage[] = [];
  let cursor = 0;

  while (cursor < rows.length) {
    const remaining = rows.slice(cursor);
    const templateId = mode === 'auto' ? chooseAutoTemplate(remaining) : mode;
    const pageRows = remaining.slice(0, templateId);

    pages.push({
      pageNumber: pages.length + 1,
      templateId,
      rows: pageRows,
    });

    cursor += pageRows.length;
  }

  return pages;
}