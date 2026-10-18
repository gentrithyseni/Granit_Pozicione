import type { ParsedRow } from './excel';
import { groupRowsBySection } from './paramasaPreview';
import { packSectionIntoPages, TEMPLATE_SLOTS, type TemplateId, type LibriPage } from './libriPaging';

const ROMAN_NUMERALS: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRomanNumeral(num: number): string {
  let remaining = num;
  let result = '';
  for (const [value, symbol] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result || String(num);
}

/** "Llogaria me ofertë" duhet të jetë VETËM numri romak i seksionit (p.sh. "II"). */
export function extractSectionAccountNumber(sectionLabel: string): string {
  const trimmed = sectionLabel.trim();
  const romanMatch = /^([IVXLCDM]+)\b/i.exec(trimmed);
  if (romanMatch) return romanMatch[1].toUpperCase();
  const arabicMatch = /^(\d+)/.exec(trimmed);
  if (arabicMatch) return toRomanNumeral(Number(arabicMatch[1]));
  return trimmed;
}

export type LibriExportPosition = {
  positionNumber: string;
  description: string;
  unit: string;
  lines: Array<{ label: string; value: number }>;
  total: number;
};

export function buildLibriExportPositions(rows: ParsedRow[]): LibriExportPosition[] {
  return rows.map((row) => {
    if (row.source === 'libri' && row.measurements && row.measurements.length > 0) {
      return {
        positionNumber: row.position_number,
        description: row.description,
        unit: row.unit,
        lines: row.measurements.map((m) => ({ label: m.raw, value: m.a })),
        total: row.quantity,
      };
    }

    const qty = Number(row.quantity || 0);
    const unitPrice = Number(row.unit_price || 0);
    const lineTotal = Number(row.total_price || 0) || qty * unitPrice;
    return {
      positionNumber: row.position_number,
      description: row.description,
      unit: row.unit,
      lines: [{ label: `${qty.toFixed(2)} x ${unitPrice.toFixed(2)}  = ${lineTotal.toFixed(2)}`, value: qty }],
      total: qty,
    };
  });
}

export type LibriExportPlanPage = {
  templateId: TemplateId;
  sectionKey: string;
  sectionLabel: string;
  rows: ParsedRow[];
  overflowWarning: boolean;
  mixedUnitsWarning: boolean;
};

export type StoredLibriExportPlanPage = {
  templateId: TemplateId;
  sectionKey: string;
  sectionLabel: string;
  rowIndexes: number[];
  overflowWarning: boolean;
  mixedUnitsWarning: boolean;
};

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'number' && [1, 2, 3, 4, 5].includes(value);
}

export function serializeLibriExportPlan(
  plan: LibriExportPlanPage[],
  sourceRows: ParsedRow[]
): StoredLibriExportPlanPage[] | null {
  if (plan.length === 0 || sourceRows.length === 0) return null;
  const rowIndexes = new Map<ParsedRow, number[]>();
  const unmatchedIndexes = new Map<string, number[]>();
  sourceRows.forEach((row, index) => {
    const identityIndexes = rowIndexes.get(row) ?? [];
    identityIndexes.push(index);
    rowIndexes.set(row, identityIndexes);

    const key = JSON.stringify(row);
    const indexes = unmatchedIndexes.get(key) ?? [];
    indexes.push(index);
    unmatchedIndexes.set(key, indexes);
  });
  const seen = new Set<number>();
  const storedPlan: StoredLibriExportPlanPage[] = [];

  for (const page of plan) {
    if (page.rows.length === 0 || page.rows.length > TEMPLATE_SLOTS[page.templateId].length) {
      return null;
    }

    const indexes: number[] = [];
    for (const row of page.rows) {
      let index = rowIndexes.get(row)?.find((candidate) => !seen.has(candidate));

      if (index === undefined) {
        const candidates = unmatchedIndexes.get(JSON.stringify(row));
        index = candidates?.find((candidate) => !seen.has(candidate));
      }
      if (index === undefined || seen.has(index)) return null;

      seen.add(index);
      indexes.push(index);
    }

    storedPlan.push({
      templateId: page.templateId,
      sectionKey: page.sectionKey,
      sectionLabel: page.sectionLabel,
      rowIndexes: indexes,
      overflowWarning: page.overflowWarning,
      mixedUnitsWarning: page.mixedUnitsWarning,
    });
  }

  return seen.size === sourceRows.length ? storedPlan : null;
}

export function restoreLibriExportPlan(
  storedPlan: unknown,
  sourceRows: ParsedRow[]
): LibriExportPlanPage[] | null {
  if (!Array.isArray(storedPlan) || storedPlan.length === 0 || sourceRows.length === 0) return null;

  const seen = new Set<number>();
  const restoredPlan: LibriExportPlanPage[] = [];

  for (const value of storedPlan) {
    if (!value || typeof value !== 'object') return null;
    const page = value as Partial<StoredLibriExportPlanPage>;
    const templateId = page.templateId;
    if (
      !isTemplateId(templateId) ||
      typeof page.sectionKey !== 'string' ||
      typeof page.sectionLabel !== 'string' ||
      !Array.isArray(page.rowIndexes) ||
      page.rowIndexes.length === 0 ||
      page.rowIndexes.length > TEMPLATE_SLOTS[templateId].length
    ) {
      return null;
    }

    const rowIndexes: number[] = [];
    for (const index of page.rowIndexes) {
      if (
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= sourceRows.length ||
        seen.has(index)
      ) {
        return null;
      }
      rowIndexes.push(index);
    }

    rowIndexes.forEach((index) => seen.add(index));
    restoredPlan.push({
      templateId,
      sectionKey: page.sectionKey,
      sectionLabel: page.sectionLabel,
      rows: rowIndexes.map((index) => sourceRows[index]),
      overflowWarning: page.overflowWarning === true,
      mixedUnitsWarning: page.mixedUnitsWarning === true,
    });
  }

  return seen.size === sourceRows.length ? restoredPlan : null;
}

export function planLibriExport(rows: ParsedRow[], sectionTitleOverrides?: Record<string, string>): LibriExportPlanPage[] {
  const sections = groupRowsBySection(rows);
  const plan: LibriExportPlanPage[] = [];
  sections.forEach((section) => {
    const pages: LibriPage[] = packSectionIntoPages(section.rows);
    const label = sectionTitleOverrides?.[section.sectionKey] || section.sectionLabel;
    pages.forEach((page) => {
      plan.push({
        templateId: page.templateId,
        sectionKey: section.sectionKey,
        sectionLabel: label,
        rows: page.rows,
        overflowWarning: page.overflowWarning,
        mixedUnitsWarning: page.mixedUnitsWarning,
      });
    });
  });
  return plan;
}
