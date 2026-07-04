// Parser për formatin real të "Librit Ndërtimor" (skedarët Shablloni-1..5 Faqe.xlsx).
//
// Ky format ndryshon rrënjësisht nga "paramasa tabelore" (excel.ts): është një faqe/seksion
// A4 me metadata bilinguale (shqip/anglisht) sipër, e ndjekur nga blloqe pozicionesh —
// secili pozicion ka një përshkrim, dhe nën të një ose disa rreshta "matje" në formën
//   A x B = REZULTAT      (p.sh. "71.5 x 20.00 = 1430.00")
// të cilat mbyllen me një rresht "Gjithsejt :" që mbledh vlerat e kolonës F (sasia).
//
// Shembull rreshtash reale (nga Shablloni-1 Faqe.xlsx, indekse kolone A=0..H=7):
//   A17: "3.1 Blerja, transporti dhe montimi i përdeve..."   (përshkrimi, fillon me nr. pozicionit)
//   E20: " 71.5 x 20.00  = 1430.00"   F20: 71.5              (rresht matjeje)
//   E21: "Gjithsejt :"                H21: (formulë shumë)   (mbyllja e bllokut)

export type LibriMeasurementLine = {
  raw: string;
  a: number;
  b: number;
  result: number;
};

export type LibriPosition = {
  positionNumber: string;
  description: string;
  unit: string;
  quantity: number;
  measurements: LibriMeasurementLine[];
};

export type LibriMeta = {
  executorName: string;
  month: string;
  objectName: string;
  sectionCode: string;
  sectionTitle: string;
  offerAccount: string;
  offerPositions: string;
  unit: string;
};

export type LibriSheetResult = {
  sheetName: string;
  meta: LibriMeta;
  positions: LibriPosition[];
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/\s+/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const MEASUREMENT_LINE_RE = /^([\d.,]+)\s*x\s*([\d.,]+)\s*=\s*([\d.,]+)$/i;
const GJITHSEJT_RE = /^gjithsejt\s*:?$/i;
const CARRY_OVER_RE = /per\s*bartje|it\s*continuous/i;
const SIGNATURE_RE = /kryesi\s*i\s*pun|organi\s*mbikqyr/i;
const POSITION_START_RE = /^([IVXLCDM]+(?:\.\d+)*|\d+(?:\.\d+)*)\s+\S/i;

/** Zbulon nëse një fletë Excel është e formatit "Libri Ndërtimor" (Shablloni-Faqe). */
export function isLibriNdertimorSheet(rows: unknown[][]): boolean {
  for (const row of rows.slice(0, 15)) {
    for (const cell of row || []) {
      const text = normalize(toText(cell));
      if (text.includes('libri ndertimor') || text.includes('construction book')) return true;
    }
  }
  return false;
}

function findRowIndex(rows: unknown[][], predicate: (row: unknown[]) => boolean, from = 0): number {
  for (let i = from; i < rows.length; i += 1) {
    if (predicate(rows[i] || [])) return i;
  }
  return -1;
}

function extractMeta(rows: unknown[][]): LibriMeta {
  let executorName = '';
  let month = '';
  let objectName = '';
  let sectionCode = '';
  let sectionTitle = '';
  let offerAccount = '';
  let offerPositions = '';
  let unit = '';

  const objectLines: string[] = [];

  rows.forEach((row) => {
    row?.forEach((cell) => {
      const text = toText(cell);
      if (!text) return;
      const lower = normalize(text);

      if (lower.startsWith('muaji-month')) {
        month = text.replace(/muaji-month/i, '').trim();
      } else if (lower.startsWith('kryerësi i punëve') || lower.startsWith('kryeresi i puneve')) {
        executorName = text.replace(/kryer[eë]si i pun[eë]ve/i, '').trim().replace(/^["']|["']$/g, '').trim();
      } else if (lower.startsWith('objekti-building')) {
        objectLines.push(text.replace(/objekti-building\s*:?/i, '').trim());
      } else if (lower.startsWith('masa')) {
        unit = text.replace(/masa/i, '').trim();
      }
    });
  });

  // rreshtat vijues të "Objekti-Building" (merge vertikal, p.sh. F3:H6) mund të vazhdojnë
  // në rreshta pa etiketë — i marrim derisa hasim "Libri ndërtimor"
  const libriRowIndex = findRowIndex(rows, (row) => row.some((c) => normalize(toText(c)).includes('libri ndertimor')));
  const objectStartIndex = findRowIndex(rows, (row) => row.some((c) => normalize(toText(c)).startsWith('objekti-building')));
  if (objectStartIndex >= 0) {
    for (let i = objectStartIndex + 1; i < (libriRowIndex >= 0 ? libriRowIndex : objectStartIndex + 4); i += 1) {
      const row = rows[i] || [];
      const extraText = row.map(toText).filter(Boolean).join(' ');
      if (extraText && !normalize(extraText).startsWith('libri ndertimor')) objectLines.push(extraText);
    }
  }
  objectName = objectLines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  // "Llogaria me ofertë" qëndron gjithmonë në kolonën F (index 5), dhe "Poz. Me ofertë" në
  // kolonën H (index 7) — pavarësisht se në cilin rresht saktësisht bien (ndryshon nga faqja
  // në faqe). Kërkojmë secilën kolonë veç e veç, në vend që të mbështetemi te rendi i rreshtave.
  const NO_RE = /^\s*no\s+/i;
  const accountRowIndex = findRowIndex(rows, (row) => NO_RE.test(toText(row[5])));
  if (accountRowIndex >= 0) {
    offerAccount = toText(rows[accountRowIndex][5]).trim();
    sectionCode = offerAccount.replace(NO_RE, '').trim();
  }
  const positionsRowIndex = findRowIndex(rows, (row) => NO_RE.test(toText(row[7])));
  if (positionsRowIndex >= 0) {
    offerPositions = toText(rows[positionsRowIndex][7]).replace(NO_RE, '').trim();
  }

  // Titulli i seksionit: kolona A e fundit jo-bosh para rreshtit "Njësia matëse", brenda zonës
  // së header-it (pas "Pozicioni i punës - Working positions").
  const workingPositionsRowIndex = findRowIndex(rows, (row) => normalize(toText(row[0])).startsWith('pozicioni i punes'));
  const unitLabelRowIndex = findRowIndex(rows, (row) => normalize(toText(row[0])).startsWith('njesia matese'));
  if (workingPositionsRowIndex >= 0 && unitLabelRowIndex > workingPositionsRowIndex) {
    for (let i = unitLabelRowIndex - 1; i > workingPositionsRowIndex; i -= 1) {
      const text = toText((rows[i] || [])[0]);
      if (text) {
        sectionTitle = text;
        break;
      }
    }
  }

  return { executorName, month, objectName, sectionCode, sectionTitle, offerAccount, offerPositions, unit };
}

/** Parson një fletë të vetme në formatin Libri Ndërtimor. Kthen meta + listën e pozicioneve me matjet e tyre. */
export function parseLibriSheet(rows: unknown[][], sheetName: string): LibriSheetResult {
  const meta = extractMeta(rows);
  const positions: LibriPosition[] = [];

  // gjej rreshtin ku fillon zona e të dhënave (pas rreshtit të etiketave "A = / B = / A+B")
  const labelsRowIndex = findRowIndex(rows, (row) =>
    row.some((c) => /^\s*a\s*=/i.test(toText(c)))
  );
  const startIndex = labelsRowIndex >= 0 ? labelsRowIndex + 1 : 0;

  // gjej ku mbaron zona e pozicioneve (shenja "Për bartje" ose nënshkrimet)
  let endIndex = findRowIndex(rows, (row) => row.some((c) => CARRY_OVER_RE.test(toText(c))), startIndex);
  if (endIndex < 0) endIndex = findRowIndex(rows, (row) => row.some((c) => SIGNATURE_RE.test(toText(c))), startIndex);
  if (endIndex < 0) endIndex = rows.length;

  let cursor = startIndex;
  while (cursor < endIndex) {
    const row = rows[cursor] || [];
    const descCellText = toText(row[0]);

    if (descCellText && POSITION_START_RE.test(descCellText)) {
      const match = /^([IVXLCDM]+(?:\.\d+)*|\d+(?:\.\d+)*)\s+([\s\S]*)$/i.exec(descCellText);
      const positionNumber = match ? match[1] : '';
      const description = match ? match[2].trim() : descCellText;

      // skano rreshtat pasues për linjat e matjes deri te "Gjithsejt :" ose pozicioni tjetër
      const measurements: LibriMeasurementLine[] = [];
      let scan = cursor + 1;
      while (scan < endIndex) {
        const scanRow = rows[scan] || [];
        const nextDesc = toText(scanRow[0]);
        if (nextDesc && POSITION_START_RE.test(nextDesc)) break; // fillon pozicioni tjetër

        const eText = toText(scanRow[4]); // kolona E
        const measurementMatch = MEASUREMENT_LINE_RE.exec(eText);
        if (measurementMatch) {
          measurements.push({
            raw: eText,
            a: parseNumber(measurementMatch[1]),
            b: parseNumber(measurementMatch[2]),
            result: parseNumber(measurementMatch[3]),
          });
        }

        if (GJITHSEJT_RE.test(eText)) {
          scan += 1;
          break;
        }
        scan += 1;
      }

      const quantity = measurements.reduce((sum, line) => sum + line.a, 0);

      positions.push({
        positionNumber,
        description,
        unit: meta.unit || '',
        quantity,
        measurements,
      });

      cursor = scan;
      continue;
    }

    cursor += 1;
  }

  return { sheetName, meta, positions };
}
