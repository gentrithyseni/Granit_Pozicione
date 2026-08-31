import type { ParsedRow } from './excel';
import { packSectionIntoPages } from './libriPaging';
import type { LibriExportPlanPage } from './libriExport';

const MAX_POSITIONS_PER_PAGE = 5;

function toExportPages(
  packed: ReturnType<typeof packSectionIntoPages>,
  sectionKey: string,
  sectionLabel: string
): LibriExportPlanPage[] {
  return packed.map((page) => ({
    templateId: page.templateId,
    sectionKey,
    sectionLabel,
    rows: page.rows,
    overflowWarning: page.overflowWarning,
    mixedUnitsWarning: page.mixedUnitsWarning,
  }));
}

/** Bashkon faqen `pageIndex` me faqen pasardhëse në një faqe të vetme. */
export function mergeAdjacentPlanPages(
  plan: LibriExportPlanPage[],
  pageIndex: number
): LibriExportPlanPage[] | { error: string } {
  if (pageIndex < 0 || pageIndex >= plan.length - 1) {
    return { error: 'Nuk ka faqe tjetër për ta bashkuar.' };
  }

  const left = plan[pageIndex];
  const right = plan[pageIndex + 1];
  const mergedRows = [...left.rows, ...right.rows];

  if (mergedRows.length > MAX_POSITIONS_PER_PAGE) {
    return { error: `Maksimumi ${MAX_POSITIONS_PER_PAGE} pozicione për faqe — shablloni nuk mbulon më shumë.` };
  }

  const packed = packSectionIntoPages(mergedRows);
  if (packed.length !== 1) {
    return { error: 'Përshkrimet janë shumë të gjata për një faqe të vetme — provo ndarje tjetër.' };
  }

  const sectionLabel = left.sectionLabel === right.sectionLabel
    ? left.sectionLabel
    : `${left.sectionLabel} + ${right.sectionLabel}`;
  const sectionKey = left.sectionKey === right.sectionKey
    ? left.sectionKey
    : `${left.sectionKey}::${right.sectionKey}`;

  const mergedPage: LibriExportPlanPage = {
    ...packed[0],
    sectionKey,
    sectionLabel,
  };

  return [...plan.slice(0, pageIndex), mergedPage, ...plan.slice(pageIndex + 2)];
}

/** Ndan faqen pas pozicionit `splitAfterRowIndex` (1 = pas pozicionit të parë). */
export function splitPlanPage(
  plan: LibriExportPlanPage[],
  pageIndex: number,
  splitAfterRowIndex: number
): LibriExportPlanPage[] | { error: string } {
  const page = plan[pageIndex];
  if (!page) return { error: 'Faqja nuk u gjet.' };
  if (splitAfterRowIndex < 1 || splitAfterRowIndex >= page.rows.length) {
    return { error: 'Zgjidh ku të ndahet faqja (midis dy pozicioneve).' };
  }

  const firstRows = page.rows.slice(0, splitAfterRowIndex);
  const secondRows = page.rows.slice(splitAfterRowIndex);

  const firstPages = toExportPages(packSectionIntoPages(firstRows), page.sectionKey, page.sectionLabel);
  const secondPages = toExportPages(packSectionIntoPages(secondRows), page.sectionKey, page.sectionLabel);

  return [...plan.slice(0, pageIndex), ...firstPages, ...secondPages, ...plan.slice(pageIndex + 1)];
}

/** Lëviz një pozicion nga një faqe në tjetrën. */
export function movePositionToPage(
  plan: LibriExportPlanPage[],
  fromPageIndex: number,
  rowIndex: number,
  toPageIndex: number
): LibriExportPlanPage[] | { error: string } {
  if (fromPageIndex === toPageIndex) return { error: 'Zgjidh faqe tjetër destinacion.' };
  const fromPage = plan[fromPageIndex];
  const toPage = plan[toPageIndex];
  if (!fromPage || !toPage) return { error: 'Faqja nuk u gjet.' };
  if (rowIndex < 0 || rowIndex >= fromPage.rows.length) return { error: 'Pozicioni nuk u gjet.' };

  const row = fromPage.rows[rowIndex];
  const newToRows = [...toPage.rows, row];
  if (newToRows.length > MAX_POSITIONS_PER_PAGE) {
    return { error: `Faqja destinacion ka maksimum ${MAX_POSITIONS_PER_PAGE} pozicione.` };
  }

  const toPacked = packSectionIntoPages(newToRows);
  if (toPacked.length !== 1) {
    return { error: 'Pozicioni nuk hyn në faqen e zgjedhur — provo faqe tjetër ose ndaje fillimisht.' };
  }

  const newFromRows = fromPage.rows.filter((_, i) => i !== rowIndex);
  const updated: LibriExportPlanPage[] = [];

  plan.forEach((page, pageIdx) => {
    if (pageIdx === fromPageIndex) {
      if (newFromRows.length === 0) return;
      updated.push(...toExportPages(packSectionIntoPages(newFromRows), page.sectionKey, page.sectionLabel));
      return;
    }
    if (pageIdx === toPageIndex) {
      updated.push({
        ...toPacked[0],
        sectionKey: page.sectionKey,
        sectionLabel: page.sectionLabel,
      });
      return;
    }
    updated.push(page);
  });

  return updated;
}
