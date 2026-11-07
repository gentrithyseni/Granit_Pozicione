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
  rowNumber: number;
};

export type LibriPosition = {
  positionNumber: string;
  description: string;
  unit: string;
  quantity: number;
  measurements: LibriMeasurementLine[];
  issues: string[];
  sourceRow: number;
};

export type LibriSheetIssue = {
  rowNumber?: number;
  message: string;
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
  issues: LibriSheetIssue[];
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

function parseNumber(value: string): { value: number; ambiguous: boolean } {
  let normalized = value.replace(/\s+/g, '');
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let ambiguous = false;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    normalized = normalized.split(grouping).join('');
    const decimalIndex = normalized.lastIndexOf(decimal);
    normalized = `${normalized.slice(0, decimalIndex).split(decimal).join('')}.${normalized.slice(decimalIndex + 1)}`;
  } else {
    const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (separator) {
      const segments = normalized.split(separator);
      if (segments.length > 2 && segments.slice(1).every((segment) => segment.length === 3)) {
        normalized = segments.join('');
      } else if (segments.length > 2) {
        const decimal = segments.pop() || '';
        normalized = `${segments.join('')}.${decimal}`;
      } else {
        ambiguous = segments[1]?.length === 3;
        normalized = normalized.replace(separator, '.');
      }
    }
  }

  const parsed = Number(normalized);
  return { value: Number.isFinite(parsed) ? parsed : 0, ambiguous };
}

const MEASUREMENT_LINE_RE = /^([\d.,]+)\s*[x×]\s*([\d.,]+)\s*=\s*([\d.,]+)$/i;
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

  const objectLabelPattern = /^(?:objekti|objekt|object|building)\s*(?:[-/]\s*(?:building|object))?\s*[:\-]?\s*(.*)$/i;
  const objectStartIndex = findRowIndex(rows, (row) => row.some((cell) => objectLabelPattern.test(toText(cell))));
  if (objectStartIndex >= 0) {
    const row = rows[objectStartIndex] || [];
    const objectCellIndex = row.findIndex((cell) => objectLabelPattern.test(toText(cell)));
    const objectCellText = toText(row[objectCellIndex]);
    const inlineMatch = objectLabelPattern.exec(objectCellText);
    const inlineObject = toText(inlineMatch?.[1]);
    if (inlineObject) {
      objectLines.push(inlineObject);
    } else {
      const sameRowValue = row.slice(objectCellIndex + 1).map(toText).find(Boolean);
      if (sameRowValue) objectLines.push(sameRowValue);

      for (let i = objectStartIndex + 1; i < Math.min(rows.length, objectStartIndex + 4); i += 1) {
        const nextRow = rows[i] || [];
        const values = nextRow.map(toText).filter(Boolean);
        if (values.length === 0) continue;
        const firstValue = normalize(values[0]);
        if (
          firstValue.startsWith('libri ndertimor') ||
          firstValue.startsWith('construction book') ||
          firstValue.startsWith('kryeresi') ||
          firstValue.startsWith('muaji') ||
          firstValue.startsWith('pozicioni i punes') ||
          firstValue.startsWith('njesia matese') ||
          firstValue.startsWith('llogaria me oferte') ||
          firstValue.startsWith('masa')
        ) break;
        if (values.length > 1 || /^(?:[IVXLCDM]+|\d+(?:\.\d+)*)\s+\S/i.test(values[0])) break;
        objectLines.push(values.join(' '));
      }
    }
  }
  objectName = [...new Set(objectLines.map((line) => line.trim()).filter(Boolean))].join(' ').replace(/\s+/g, ' ').trim();

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
  const issues: LibriSheetIssue[] = [];

  [
    ['Kryesi i punëve', meta.executorName],
    ['Muaji', meta.month],
    ['Objekti', meta.objectName],
    ['Titulli i seksionit', meta.sectionTitle],
    ['Njësia matëse', meta.unit],
  ].forEach(([label, value]) => {
    if (!value) issues.push({ message: `Nuk u identifikua metadata "${label}"; kontrolloje para eksportit.` });
  });

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
      const positionIssues: string[] = [];
      let declaredPositionTotal: number | null = null;
      let declaredTotalRowNumber: number | null = null;
      let scan = cursor + 1;
      while (scan < endIndex) {
        const scanRow = rows[scan] || [];
        const nextDesc = toText(scanRow[0]);
        if (nextDesc && POSITION_START_RE.test(nextDesc)) break; // fillon pozicioni tjetër

        const eText = toText(scanRow[4]); // kolona E
        const measurementMatch = MEASUREMENT_LINE_RE.exec(eText);
        if (measurementMatch) {
          const a = parseNumber(measurementMatch[1]);
          const b = parseNumber(measurementMatch[2]);
          const result = parseNumber(measurementMatch[3]);
          const expectedResult = a.value * b.value;
          const tolerance = Math.max(0.01, Math.abs(expectedResult) * 0.005);
          if (a.ambiguous || b.ambiguous || result.ambiguous) {
            positionIssues.push(`Rreshti ${scan + 1}: numër matjeje me ndarës të paqartë ("${eText}"); verifiko vlerat.`);
          }
          if (Math.abs(expectedResult - result.value) > tolerance) {
            positionIssues.push(
              `Rreshti ${scan + 1}: rezultati i matjes (${result.value}) nuk përputhet me A × B (${expectedResult.toFixed(3)}).`
            );
          }
          measurements.push({
            raw: eText,
            a: a.value,
            b: b.value,
            result: result.value,
            rowNumber: scan + 1,
          });
        } else if (/[x×=]/i.test(eText) && /\d/.test(eText)) {
          positionIssues.push(`Rreshti ${scan + 1}: rreshti i matjes nuk u njoh ("${eText}").`);
        }

        if (GJITHSEJT_RE.test(eText)) {
          const totalCell = scanRow[7];
          if (typeof totalCell === 'number' && Number.isFinite(totalCell)) {
            declaredPositionTotal = totalCell;
            declaredTotalRowNumber = scan + 1;
          } else if (typeof totalCell === 'string' && /^[+-]?[\d.,]+$/.test(totalCell.trim())) {
            const parsedTotal = parseNumber(totalCell);
            declaredPositionTotal = parsedTotal.value;
            declaredTotalRowNumber = scan + 1;
            if (parsedTotal.ambiguous) {
              positionIssues.push(`Rreshti ${scan + 1}: totali i pozicionit "${totalCell}" ka ndarës të paqartë; verifikoje.`);
            }
          }
          scan += 1;
          break;
        }
        scan += 1;
      }

      const quantity = measurements.reduce((sum, line) => sum + line.a, 0);
      if (measurements.length === 0) {
        positionIssues.push('Nuk u gjet asnjë rresht matjeje për këtë pozicion; kontrollo kolonën E dhe formatin e matjeve.');
      }
      if (declaredPositionTotal !== null) {
        const tolerance = Math.max(0.01, Math.abs(declaredPositionTotal) * 0.005);
        if (Math.abs(declaredPositionTotal - quantity) > tolerance) {
          positionIssues.push(
            `Rreshti ${declaredTotalRowNumber}: totali i fletës (${declaredPositionTotal}) nuk përputhet me shumën e kolonës A (${quantity}).`
          );
        }
      }

      positions.push({
        positionNumber,
        description,
        unit: meta.unit || '',
        quantity,
        measurements,
        issues: positionIssues,
        sourceRow: cursor + 1,
      });

      cursor = scan;
      continue;
    }

    cursor += 1;
  }

  return { sheetName, meta, positions, issues };
}
