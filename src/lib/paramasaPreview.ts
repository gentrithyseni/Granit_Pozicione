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

export function groupRowsBySection(rows: ParsedRow[]): ParamasaSection[] {
  const sections = new Map<string, ParamasaSection>();

  rows.forEach((row) => {
    const root = getPositionRoot(row.position_number);
    const sectionKey = root || row.position_number || 'unknown';
    const existing = sections.get(sectionKey);
    if (existing) {
      existing.rows.push(row);
      return;
    }

    sections.set(sectionKey, {
      sectionKey,
      sectionLabel: isRomanRoot(sectionKey) || isNumericRoot(sectionKey) ? `${sectionKey}.` : sectionKey,
      rows: [row],
    });
  });

  return Array.from(sections.values());
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
