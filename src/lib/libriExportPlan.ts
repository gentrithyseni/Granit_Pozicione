import type { ParsedRow } from './excel';
import { groupRowsBySection } from './paramasaPreview';
import { packSectionIntoPages, type TemplateId, type LibriPage } from './libriPaging';

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
