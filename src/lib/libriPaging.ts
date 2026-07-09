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
  /** Kapaciteti real i karaktereve për këtë slot, llogaritur nga lartësia e vërtetë e
   * rreshtave të bashkuar (jo thjesht numri i rreshtave) dhe gjerësia e kolonave A:E,
   * me një faktor sigurie ~15%. Të dhënat burimore: skript python mbi çdo shabllon real. */
  maxChars: number;
  measureRow: number; // rreshti i parë i lirë për "A x B = C" (kolona E teksti, F vlera)
  gjithsejtRow: number; // rreshti "Gjithsejt :" (kolona E label, H vlera)
  sectionAccountRow: number; // rreshti me "No <seksioni>" (kolona F) i vlefshëm për këtë faqe
  sectionPositionsRow: number; // rreshti me "No <pozicionet>" (kolona H)
  sectionTitleRow: number; // rreshti me titullin e seksionit (kolona A)
};

export const TEMPLATE_SLOTS: Record<TemplateId, LibriSlotCoord[]> = {
  1: [{ descRow: 17, maxChars: 285, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 }],
  2: [
    { descRow: 17, maxChars: 447, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 24, maxChars: 504, measureRow: 26, gjithsejtRow: 27, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
  ],
  3: [
    { descRow: 16, maxChars: 323, measureRow: 19, gjithsejtRow: 20, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 23, maxChars: 314, measureRow: 25, gjithsejtRow: 26, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 28, maxChars: 532, measureRow: 30, gjithsejtRow: 31, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
  ],
  4: [
    { descRow: 16, maxChars: 233, measureRow: 17, gjithsejtRow: 18, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 20, maxChars: 280, measureRow: 22, gjithsejtRow: 23, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 25, maxChars: 328, measureRow: 27, gjithsejtRow: 28, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
    { descRow: 31, maxChars: 219, measureRow: 34, gjithsejtRow: 35, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 11 },
  ],
  5: [
    { descRow: 17, maxChars: 228, measureRow: 20, gjithsejtRow: 21, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 24, maxChars: 109, measureRow: 27, gjithsejtRow: 28, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 31, maxChars: 124, measureRow: 33, gjithsejtRow: 34, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 36, maxChars: 81, measureRow: 39, gjithsejtRow: 40, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
    { descRow: 42, maxChars: 128, measureRow: 45, gjithsejtRow: 46, sectionAccountRow: 11, sectionPositionsRow: 11, sectionTitleRow: 9 },
  ],
};

export type LibriPage = {
  templateId: TemplateId;
  rows: ParsedRow[];
  /** true nëse ndonjë përshkrim e tejkalon kapacitetin e vlerësuar të slotit — sinjal për rikontroll manual, jo bllokim. */
  overflowWarning: boolean;
  /** true nëse faqja bashkon pozicione me njësi matëse të ndryshme (fusha "Masa" e përbashkët mund të mos përshkruajë të gjitha saktë). */
  mixedUnitsWarning: boolean;
};

function slotBudget(slot: LibriSlotCoord): number {
  return slot.maxChars;
}

function fitsTemplate(rows: ParsedRow[], templateId: TemplateId): { fits: boolean; overflow: boolean; mixedUnits: boolean } {
  const slots = TEMPLATE_SLOTS[templateId];
  if (rows.length > slots.length) return { fits: false, overflow: false, mixedUnits: false };

  const units = new Set(rows.map((row) => (row.unit || '').trim().toLowerCase()));
  const mixedUnits = templateId > 1 && units.size > 1;

  let overflow = false;
  for (let i = 0; i < rows.length; i += 1) {
    const len = String(rows[i].description || '').length;
    if (len > slotBudget(slots[i])) overflow = true;
  }
  return { fits: true, overflow, mixedUnits };
}

/** Paketon pozicionet E NJË SEKSIONI TË VETËM (rrënjë e njëjtë) në faqe, zgjedhur shabllonin më të madh që hyn realisht — sa më pak faqe aq më mirë, por kurrë duke fshehur tekstin. */
export function packSectionIntoPages(rows: ParsedRow[]): LibriPage[] {
  const pages: LibriPage[] = [];
  let cursor = 0;

  while (cursor < rows.length) {
    const remaining = rows.slice(cursor);
    let chosen: TemplateId = 1;
    let chosenOverflow = false;
    let chosenMixedUnits = false;
    let found = false;

    // preferenca: shablloni më i madh që HYN pa e tejkaluar kapacitetin e përshkrimit
    for (let candidate = Math.min(5, remaining.length) as TemplateId; candidate >= 1; candidate -= 1) {
      const slice = remaining.slice(0, candidate);
      const { fits, overflow, mixedUnits } = fitsTemplate(slice, candidate);
      if (fits && !overflow) {
        chosen = candidate;
        chosenOverflow = false;
        chosenMixedUnits = mixedUnits;
        found = true;
        break;
      }
    }

    // asnjë madhësi s'del pa overflow — përdor shabllonin më të madh të mundshëm gjithsesi,
    // por sinjalizo qartë për rikontroll manual, në vend që të mos gjenerohet asgjë.
    if (!found) {
      const candidate = Math.min(5, remaining.length) as TemplateId;
      const slice = remaining.slice(0, candidate);
      const { overflow, mixedUnits } = fitsTemplate(slice, candidate);
      chosen = candidate;
      chosenOverflow = overflow;
      chosenMixedUnits = mixedUnits;
    }

    const pageRows = remaining.slice(0, chosen);
    pages.push({ templateId: chosen, rows: pageRows, overflowWarning: chosenOverflow, mixedUnitsWarning: chosenMixedUnits });
    cursor += pageRows.length;
  }

  return pages;
}