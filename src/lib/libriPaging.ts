// Motori i paketimit të pozicioneve në faqet e Librit Ndërtimor.
//
// Rregulla kyçe (të kërkuara shprehimisht):
//   1. Asnjë faqe s'i përzien pozicionet e dy seksioneve të ndryshme (p.sh. IV me V) —
//      ndarja fillon gjithmonë duke grupuar sipas rrënjës së seksionit (groupRowsBySection).
//   2. Përzgjedhja e shabllonit (1-5 pozicione/faqe) bëhet vetëm nëse përshkrimet e
//      pozicioneve hyjnë realisht brenda hapësirës së bashkuar (merged cells) të atij
//      "vendi" (slot) në shabllonin real — përndryshe zbret te shablloni më i vogël, deri
//      në rastin më të sigurt (1 pozicion/faqe), në vend që të rrezikojë përmbajtje që "del
//      jashtë kutisë" në Excel.

import type { ParsedRow } from './excel';

export type TemplateId = 1 | 2 | 3 | 4 | 5;

export type LibriSlotCoord = {
  descRow: number;
  descRowSpan: number; // numri i rreshtave të bashkuar (A{descRow}:E{descRow+span-1})
  measureRow: number; // rreshti i parë i lirë për "A x B = C" (kolona E teksti, F vlera)
  gjithsejtRow: number; // rreshti "Gjithsejt :" (kolona E label, H vlera)
  sectionAccountRow: number; // rreshti me "No <seksioni>" (kolona F) i vlefshëm për këtë faqe
  sectionPositionsRow: number; // rreshti me "No <pozicionet>" (kolona H)
  sectionTitleRow: number; // rreshti me titullin e seksionit (kolona A)
};

// ~58 karaktere/rresht është konvencioni tashmë i përdorur në paramasaPreview.ts
// (estimateRowUnits) — e ripërdorim për konsistencë mes preview-t dhe eksportit real.
const CHARS_PER_ROW = 58;

export const TEMPLATE_SLOTS: Record<TemplateId, LibriSlotCoord[]> = {
  1: [{ descRow: 17, descRowSpan: 3, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 }],
  2: [
    { descRow: 17, descRowSpan: 3, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 24, descRowSpan: 2, measureRow: 26, gjithsejtRow: 27, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
  ],
  3: [
    { descRow: 16, descRowSpan: 3, measureRow: 19, gjithsejtRow: 20, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 23, descRowSpan: 2, measureRow: 25, gjithsejtRow: 26, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 28, descRowSpan: 2, measureRow: 30, gjithsejtRow: 31, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
  ],
  4: [
    { descRow: 16, descRowSpan: 1, measureRow: 17, gjithsejtRow: 18, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 20, descRowSpan: 2, measureRow: 22, gjithsejtRow: 23, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 25, descRowSpan: 2, measureRow: 27, gjithsejtRow: 28, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 31, descRowSpan: 3, measureRow: 34, gjithsejtRow: 35, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
  ],
  5: [
    { descRow: 17, descRowSpan: 3, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 24, descRowSpan: 3, measureRow: 27, gjithsejtRow: 28, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 31, descRowSpan: 2, measureRow: 33, gjithsejtRow: 34, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 36, descRowSpan: 3, measureRow: 39, gjithsejtRow: 40, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 42, descRowSpan: 3, measureRow: 45, gjithsejtRow: 46, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
  ],
};

export type LibriPage = {
  templateId: TemplateId;
  rows: ParsedRow[];
  /** true nëse ndonjë përshkrim e tejkalon kapacitetin e vlerësuar të slotit — sinjal për rikontroll manual, jo bllokim. */
  overflowWarning: boolean;
};

function slotBudget(slot: LibriSlotCoord): number {
  return slot.descRowSpan * CHARS_PER_ROW;
}

function fitsTemplate(rows: ParsedRow[], templateId: TemplateId): { fits: boolean; overflow: boolean } {
  const slots = TEMPLATE_SLOTS[templateId];
  if (rows.length > slots.length) return { fits: false, overflow: false };

  // siguri shtesë: mos i vendos në të njëjtën faqe pozicione me njësi matëse të ndryshme,
  // sepse fusha "Masa" në krye të faqes është e përbashkët për të gjitha pozicionet e faqes.
  if (templateId > 1) {
    const units = new Set(rows.map((row) => (row.unit || '').trim().toLowerCase()));
    if (units.size > 1) return { fits: false, overflow: false };
  }

  let overflow = false;
  for (let i = 0; i < rows.length; i += 1) {
    const len = String(rows[i].description || '').length;
    if (len > slotBudget(slots[i])) overflow = true;
  }
  return { fits: true, overflow };
}

/** Paketon pozicionet E NJË SEKSIONI TË VETËM (rrënjë e njëjtë) në faqe, zgjedhur shabllonin më të madh që hyn realisht. */
export function packSectionIntoPages(rows: ParsedRow[]): LibriPage[] {
  const pages: LibriPage[] = [];
  let cursor = 0;

  while (cursor < rows.length) {
    const remaining = rows.slice(cursor);
    let chosen: TemplateId = 1;
    let chosenOverflow = false;

    for (let candidate = Math.min(5, remaining.length) as TemplateId; candidate >= 1; candidate -= 1) {
      const slice = remaining.slice(0, candidate);
      const { fits, overflow } = fitsTemplate(slice, candidate);
      if (fits && !overflow) {
        chosen = candidate;
        chosenOverflow = false;
        break;
      }
      // ruaje si "rezervë" nëse asnjë madhësi s'del pa overflow — më mirë 1/faqe me overflow
      // flag sesa të mos gjenerohet asgjë.
      if (candidate === 1) {
        chosen = 1;
        chosenOverflow = overflow;
      }
    }

    const pageRows = remaining.slice(0, chosen);
    pages.push({ templateId: chosen, rows: pageRows, overflowWarning: chosenOverflow });
    cursor += pageRows.length;
  }

  return pages;
}
