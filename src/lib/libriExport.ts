// Eksport "Libri Ndërtimor" — mbush vetë skedarët origjinalë Shablloni-1..5 Faqe.xlsx
// (jo rikrijim HTML), duke ruajtur çdo stil/font/kufi/bashkim qelizash origjinal. Faqet
// paketohen automatikisht me packSectionIntoPages (libriPaging.ts), i cili garanton që:
//   - asnjë faqe s'i përzien pozicionet e dy seksioneve të ndryshme (IV s'përzihet me V);
//   - shablloni multi-pozicion (2-5) përdoret VETËM kur përshkrimet hyjnë realisht në
//     hapësirën e bashkuar të atij "slot"-i real dhe njësia matëse është e njëjtë;
//   - përndryshe kthehet automatikisht te 1-pozicion/faqe (Shablloni-1), gjithmonë e sigurt.

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { ParsedRow } from './excel';
import type { ParamasaPreviewMeta } from '../types/paramasaMeta';
import { groupRowsBySection } from './paramasaPreview';
import { packSectionIntoPages, TEMPLATE_SLOTS, type TemplateId, type LibriPage } from './libriPaging';

const TEMPLATE_URLS: Record<TemplateId, string> = {
  1: '/templates/Shablloni-1-Faqe.xlsx',
  2: '/templates/Shablloni-2-Faqe.xlsx',
  3: '/templates/Shablloni-3-Faqe.xlsx',
  4: '/templates/Shablloni-4-Faqe.xlsx',
  5: '/templates/Shablloni-5-Faqe.xlsx',
};

// Koordinata fikse, njësoj në të gjitha 5 shabllonet (verifikuar direkt në skedarët reale).
const FIXED_CELLS = {
  month: { row: 1, col: 6 }, // F1
  executor: { row: 2, col: 1 }, // A2
  object: { row: 3, col: 6 }, // F3
  unit: { row: 13, col: 6 }, // F13
};

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[*?:/\\[\]]/g, ' ').trim();
  return (cleaned || 'Faqja').slice(0, 31);
}

async function loadTemplateWorkbook(templateId: TemplateId): Promise<ExcelJS.Workbook> {
  const url = TEMPLATE_URLS[templateId];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nuk u gjet shablloni në ${url}`);
  const buffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/** Klonon një fletë burimore (me stile, bashkime qelizash, gjerësi/lartësi) brenda workbook-ut të destinacionit. */
function cloneWorksheet(target: ExcelJS.Workbook, source: ExcelJS.Worksheet, name: string): ExcelJS.Worksheet {
  const lastRow = source.dimensions?.bottom || source.rowCount;
  const lastCol = source.dimensions?.right || source.columnCount || 8;
  const lastColLetter = String.fromCharCode(64 + lastCol);

  const clone = target.addWorksheet(name, {
    pageSetup: {
      ...source.pageSetup,
      // Shabllonet origjinale përdorin vetëm "scale: 92%" fiks, jo "fit to page". Kjo
      // funksiononte për një skedar të vetëm, statik — por meqë tani përmbajtja (përshkrimi)
      // ndryshon gjatësi sipas paramasës, duhet të detyrojmë "1 faqe e gjerë x 1 faqe e lartë",
      // përndryshe rreshti i nënshkrimeve ("Kryesi i punëve / Organi mbikëqyrës") mund të
      // shtyhet automatikisht në faqen e dytë kur printohet, në vend që të qëndrojë në fund
      // të faqes A4 së parë.
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      printArea: `A1:${lastColLetter}${lastRow}`,
    },
    properties: { ...source.properties },
    views: source.views?.map((v) => ({ ...v })),
  });

  clone.columns = source.columns.map((column) => ({
    width: (column as ExcelJS.Column).width,
  }));

  // RADHA KA RËNDËSI: bashkimi i qelizave (merge) bëhet PARA se t'u vendosim stilet, sepse
  // ExcelJS mund t'ua rivendosë stilin qelizave "skllave" të një range-i të bashkuar kur thirret
  // mergeCells (duke e trashëguar stilin nga qeliza "master", jo domosdoshmërisht identik me atë
  // që kishin origjinalisht). Nëse e bëjmë merge PARA, kopjimi i stilit që vjen pas e "vulos"
  // stilin e saktë origjinal mbi çdo qelizë — përfshirë kufijtë (borders) e anës së djathtë,
  // që përndryshe humbisnin (rregullim i raportuar nga përdoruesi: drejtkëndëshi dilte pa vijë djathtas).
  const merges = (source.model as unknown as { merges?: string[] }).merges || [];
  merges.forEach((range) => {
    try {
      clone.mergeCells(range);
    } catch {
      // range i pavlefshëm/i dublikuar — injorohet, nuk ndalon eksportin
    }
  });

  source.eachRow({ includeEmpty: true }, (sourceRow, rowNumber) => {
    const targetRow = clone.getRow(rowNumber);
    targetRow.height = sourceRow.height;
    targetRow.hidden = sourceRow.hidden;
    targetRow.outlineLevel = sourceRow.outlineLevel;
    sourceRow.eachCell({ includeEmpty: true }, (sourceCell, colNumber) => {
      const targetCell = targetRow.getCell(colNumber);
      targetCell.value = sourceCell.value;
      if (sourceCell.style) targetCell.style = JSON.parse(JSON.stringify(sourceCell.style));
      if (sourceCell.numFmt) targetCell.numFmt = sourceCell.numFmt;
    });
    targetRow.commit();
  });

  return clone;
}

function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number): void {
  ws.getCell(row, col).value = value;
}

type LibriExportPosition = {
  positionNumber: string;
  description: string;
  unit: string;
  lines: Array<{ label: string; value: number }>;
  total: number;
};

/** Konverton rreshtat e importuar (nga paramasa tabelore ose nga vetë Libri Ndërtimor) në pozicione gati për eksport. */
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
    return {
      positionNumber: row.position_number,
      description: row.description,
      unit: row.unit,
      lines: [{ label: `${qty.toFixed(2)} x 1.00  = ${qty.toFixed(2)}`, value: qty }],
      total: qty,
    };
  });
}

export type LibriExportPlanPage = {
  templateId: TemplateId;
  sectionLabel: string;
  rows: ParsedRow[];
  overflowWarning: boolean;
  mixedUnitsWarning: boolean;
};

/** Planifikimi (pa gjeneruar akoma xlsx) — i dobishëm për ta shfaqur në UI para shkarkimit. */
export function planLibriExport(rows: ParsedRow[]): LibriExportPlanPage[] {
  const sections = groupRowsBySection(rows);
  const plan: LibriExportPlanPage[] = [];
  sections.forEach((section) => {
    const pages: LibriPage[] = packSectionIntoPages(section.rows);
    pages.forEach((page) => {
      plan.push({
        templateId: page.templateId,
        sectionLabel: section.sectionLabel,
        rows: page.rows,
        overflowWarning: page.overflowWarning,
        mixedUnitsWarning: page.mixedUnitsWarning,
      });
    });
  });
  return plan;
}

/**
 * Gjeneron një workbook Excel me faqe identike me shabllonet reale (Shablloni-1..5 Faqe.xlsx),
 * duke paketuar automatikisht 1-5 pozicione/faqe kur është e sigurt, dhe pa përzier kurrë
 * pozicione të seksioneve të ndryshme. Kthen ArrayBuffer gati për shkarkim.
 */
export async function buildLibriNdertimorWorkbook(
  rows: ParsedRow[],
  meta: ParamasaPreviewMeta,
  templateLoader: (id: TemplateId) => Promise<ExcelJS.Workbook> = loadTemplateWorkbook
): Promise<ArrayBuffer> {
  const plan = planLibriExport(rows);
  const output = new ExcelJS.Workbook();
  output.creator = 'Graniti Web';
  output.created = new Date();

  const templateCache = new Map<TemplateId, ExcelJS.Worksheet>();
  const getTemplateSheet = async (id: TemplateId) => {
    if (!templateCache.has(id)) {
      const wb = await templateLoader(id);
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error(`Shablloni ${id} nuk ka asnjë fletë.`);
      templateCache.set(id, sheet);
    }
    return templateCache.get(id) as ExcelJS.Worksheet;
  };

  const usedNames = new Set<string>();

  for (let pageIndex = 0; pageIndex < plan.length; pageIndex += 1) {
    const page = plan[pageIndex];
    const templateSheet = await getTemplateSheet(page.templateId);

    let sheetName = sanitizeSheetName(`${pageIndex + 1}. ${page.sectionLabel}`);
    let suffix = 1;
    while (usedNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${pageIndex + 1}. ${page.sectionLabel} (${suffix})`);
      suffix += 1;
    }
    usedNames.add(sheetName);

    const ws = cloneWorksheet(output, templateSheet, sheetName);
    fillPageIntoWorksheet(ws, page, meta);
  }

  const buffer = await output.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/** Mbush një fletë tashmë të klonuar me të dhënat e një faqeje të vetme (ndarë nga logjika e sipërme, e ripërdorur edhe për shkarkimin e një faqeje të vetme). */
function fillPageIntoWorksheet(ws: ExcelJS.Worksheet, page: LibriExportPlanPage, meta: ParamasaPreviewMeta): void {
  const slots = TEMPLATE_SLOTS[page.templateId];
  const positions = buildLibriExportPositions(page.rows);

  setCell(ws, FIXED_CELLS.month.row, FIXED_CELLS.month.col, `Muaji-Month ${meta.month || ''}`.trim());
  setCell(ws, FIXED_CELLS.executor.row, FIXED_CELLS.executor.col, `Kryerësi i punëve "${meta.executorName || ''}" `);
  setCell(ws, FIXED_CELLS.object.row, FIXED_CELLS.object.col, `Objekti-Building : ${meta.objectName || ''}`);

  const headerSlot = slots[0];
  const offerPositionsList = positions.map((p) => p.positionNumber).filter(Boolean).join(', ');
  setCell(ws, headerSlot.sectionAccountRow, 6, `  No ${page.sectionLabel.replace(/\.$/, '')}`);
  setCell(ws, headerSlot.sectionPositionsRow, 8, `   No  ${offerPositionsList || meta.offerPositions || ''}`);
  setCell(ws, headerSlot.sectionTitleRow, 1, page.sectionLabel || meta.sectionTitle);

  const distinctUnits = Array.from(new Set(positions.map((p) => p.unit).filter(Boolean)));
  const unitLabel = distinctUnits.length > 1 ? distinctUnits.join(' / ') : positions[0]?.unit || '';
  setCell(ws, FIXED_CELLS.unit.row, FIXED_CELLS.unit.col, `      Masa         ${unitLabel}`);

  positions.forEach((position, slotIndex) => {
    const slot = slots[slotIndex];
    if (!slot) return;

    setCell(
      ws,
      slot.descRow,
      1,
      `${position.positionNumber ? `${position.positionNumber} ` : ''}${position.description || ''}`
    );

    const lines = position.lines;
    lines.forEach((line, lineIndex) => {
      const rowNumber = slot.measureRow + lineIndex;
      setCell(ws, rowNumber, 5, line.label);
      setCell(ws, rowNumber, 6, line.value);
    });

    const totalRow = slot.measureRow + lines.length;
    setCell(ws, totalRow, 5, 'Gjithsejt :');
    setCell(ws, totalRow, 8, position.total);
  });
}

/** Gjeneron një workbook me VETËM NJË faqe — për shkarkim individual të një faqeje të librit. */
export async function buildLibriSinglePageWorkbook(
  page: LibriExportPlanPage,
  meta: ParamasaPreviewMeta,
  templateLoader: (id: TemplateId) => Promise<ExcelJS.Workbook> = loadTemplateWorkbook
): Promise<ArrayBuffer> {
  const templateWorkbook = await templateLoader(page.templateId);
  const templateSheet = templateWorkbook.worksheets[0];
  if (!templateSheet) throw new Error(`Shablloni ${page.templateId} nuk ka asnjë fletë.`);

  const output = new ExcelJS.Workbook();
  output.creator = 'Graniti Web';
  output.created = new Date();

  const sheetName = sanitizeSheetName(page.sectionLabel || 'Faqja');
  const ws = cloneWorksheet(output, templateSheet, sheetName);
  fillPageIntoWorksheet(ws, page, meta);

  const buffer = await output.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function downloadWorkbookBuffer(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Gjeneron një ZIP me çdo faqe të Librit Ndërtimor si skedar .xlsx MË VETE brenda (jo një
 * workbook i bashkuar). Përdoret kur duhet t'i shkarkosh të gjitha faqet njëherësh por secilën
 * si skedar i pavarur (p.sh. për t'ia ndarë secilën faqe dikujt veç e veç).
 */
export async function buildLibriNdertimorZip(
  rows: ParsedRow[],
  meta: ParamasaPreviewMeta,
  templateLoader: (id: TemplateId) => Promise<ExcelJS.Workbook> = loadTemplateWorkbook
): Promise<Blob> {
  const plan = planLibriExport(rows);
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let pageIndex = 0; pageIndex < plan.length; pageIndex += 1) {
    const page = plan[pageIndex];
    const buffer = await buildLibriSinglePageWorkbook(page, meta, templateLoader);

    const safeLabel = (page.sectionLabel || `Faqja-${pageIndex + 1}`).replace(/[^\w.-]+/g, '-').replace(/\.+$/, '').replace(/-+/g, '-');
    let fileName = `Faqja-${pageIndex + 1}-${safeLabel}.xlsx`;
    let suffix = 1;
    while (usedNames.has(fileName)) {
      fileName = `Faqja-${pageIndex + 1}-${safeLabel}-(${suffix}).xlsx`;
      suffix += 1;
    }
    usedNames.add(fileName);

    zip.file(fileName, buffer);
  }

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}