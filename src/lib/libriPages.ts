import type { ParsedRow } from './excel';

export type PositionKind = 'numra' | 'romake' | 'shkronja' | 'tjeter';

export type LibriBookRow = ParsedRow & {
  positionKind: PositionKind;
  positionLabel: string;
  positionRoot: string;
};

export type LibriPreviewMeta = {
  title: string;
  company: string;
  organ: string;
  documentNumber: string;
  romanNumber: string;
  date: string;
  footerLeft: string;
  footerMiddle: string;
  footerRight: string;
};

export function detectPositionKind(positionNumber: string): PositionKind {
  const value = String(positionNumber || '').trim();
  if (/^\d+(?:\.\d+)*$/.test(value)) return 'numra';
  if (/^(?=[MDCLXVI]+$)M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(value)) return 'romake';
  if (/^[A-Z]$/i.test(value)) return 'shkronja';
  return 'tjeter';
}

export function getPositionRoot(positionNumber: string): string {
  const value = String(positionNumber || '').trim();
  const match = value.match(/^(\d+)/);
  return match ? match[1] : '';
}

export function enhanceRows(rows: ParsedRow[]): LibriBookRow[] {
  return rows.map((row) => ({
    ...row,
    positionKind: detectPositionKind(row.position_number),
    positionLabel: row.position_number || '—',
    positionRoot: getPositionRoot(row.position_number),
  }));
}

function estimateRowHeight(row: LibriBookRow): number {
  const lines = Math.max(1, Math.ceil((row.description || '').length / 70));
  return 24 + (lines - 1) * 12;
}

export function splitIntoPages(rows: LibriBookRow[]): LibriBookRow[][] {
  const pages: LibriBookRow[][] = [];
  let current: LibriBookRow[] = [];
  let heightUsed = 0;
  let currentRoot = '';
  const limit = 170;

  rows.forEach((row) => {
    const rowHeight = estimateRowHeight(row);
    const nextRoot = row.positionRoot || currentRoot;
    const rootChanged = current.length > 0 && currentRoot && nextRoot && nextRoot !== currentRoot;
    const overflow = current.length > 0 && heightUsed + rowHeight > limit;

    if (rootChanged || overflow) {
      pages.push(current);
      current = [];
      heightUsed = 0;
      currentRoot = '';
    }

    current.push(row);
    heightUsed += rowHeight;
    if (!currentRoot) currentRoot = row.positionRoot || nextRoot || '';
  });

  if (current.length > 0) pages.push(current);
  return pages;
}

export function validatePages(pages: LibriBookRow[][]): string[] {
  const issues: string[] = [];

  pages.forEach((pageRows, index) => {
    const roots = Array.from(new Set(pageRows.map((row) => row.positionRoot).filter(Boolean)));
    if (roots.length > 1) {
      issues.push(`Faqja ${index + 1} përzien grupet numerike: ${roots.join(', ')}`);
    }
  });

  return issues;
}

export function getKindLabel(kind: PositionKind): string {
  if (kind === 'numra') return 'me numra';
  if (kind === 'romake') return 'romake';
  if (kind === 'shkronja') return 'me shkronja';
  return 'të tjera';
}