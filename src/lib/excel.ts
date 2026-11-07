import * as XLSX from 'xlsx';
import { isLibriNdertimorSheet, parseLibriSheet, type LibriMeasurementLine, type LibriMeta } from './libriNdertimor';

export type ParsedRow = {
  position_number: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sheet_name?: string;
  source_row?: number;
  issues?: string[];
  /** Titulli i seksionit real (nga rreshti me numër romak, p.sh. "II PUNËT E DEMOLIMIT"),
   * kapur gjatë parsimit — përdoret si prioritet mbi grupimin e nxjerrë nga numri i pozicionit,
   * sepse disa paramasa reale kanë numërtim jo-konsistent (p.sh. pozicion "4.1" nën seksionin III). */
  section_title?: string;
  /** Indeksi i "tabelës"/dokumentit logjik brenda skedarit (0,1,2...) — disa skedarë kanë MË
   * SHUMË se një paramasë të ngulitur (p.sh. "PARAMASA E ELEKTRIKES" pas asaj kryesore).
   * Pa këtë, pozicione me numra të njëjtë nga dokumente krejt të ndryshme (p.sh. "6" nga
   * elektrika dhe "6.1" nga arkitektura) do të përziheshin gabimisht në të njëjtin seksion. */
  table_index?: number;
  /** I pranishëm vetëm kur rreshti vjen nga formati "Libri Ndërtimor" (Shablloni-Faqe). */
  measurements?: LibriMeasurementLine[];
  /** Meta i librit ndërtimor (kryesi, muaji, objekti, seksioni...) kur burimi është ai format. */
  libriMeta?: LibriMeta;
  source?: 'paramasa' | 'libri';
};

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function rowText(row: unknown[]): string {
  return row.map(toCellText).filter(Boolean).join(' | ');
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => toCellText(cell) === '');
}

function findLabeledValue(
  rows: unknown[][],
  labelPattern: RegExp,
  isValid: (value: string) => boolean = () => true,
): string {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const text = toCellText(row[cellIndex]);
      if (!text) continue;
      const match = labelPattern.exec(text);
      if (!match) continue;

      const inlineValue = toCellText(match[1]);
      const isMarkerOnly = /^\d+\s*[:.)-]?$/.test(inlineValue);
      if (inlineValue && !isMarkerOnly) {
        const value = inlineValue.replace(/^[:\s-]+/, '').trim();
        if (isValid(value)) return value;
        continue;
      }

      const sameRowValue = row.slice(cellIndex + 1).map(toCellText).find(Boolean);
      if (sameRowValue && isValid(sameRowValue)) return sameRowValue;

      for (let nextIndex = rowIndex + 1; nextIndex < Math.min(rows.length, rowIndex + 3); nextIndex += 1) {
        const nextRow = rows[nextIndex] || [];
        const nextValue = nextRow.map(toCellText).find(Boolean);
        if (nextValue && !labelPattern.test(nextValue) && isValid(nextValue)) return nextValue;
      }
    }
  }
  return '';
}

function extractWorkbookMetadata(rows: unknown[][]): WorkbookMetadataSuggestions {
  return {
    executorName: findLabeledValue(
      rows,
      /^(?:kryer[eë]si i pun[eë]ve|kryesi|kontraktori|kontraktuesi|operatori ekonomik|contractor)\s*(?:[-/:]\s*)?(.*)$/i,
      (value) => value.length <= 120 && !/\b(do te|duhet te|eshte pergjegjes|siguron)\b/.test(normalizeString(value)),
    ),
    month: findLabeledValue(rows, /^(?:muaji|month)\s*(?:[-/:]\s*)?(.*)$/i),
    objectName: findLabeledValue(rows, /^(?:emri i objektit|em[eë]rtimi i objektit|objekti|objekt|object|building|projekti|project)\s*(?:[-/]\s*(?:building|object))?\s*[:\-]?\s*(.*)$/i),
    offerAccount: findLabeledValue(rows, /^(?:llogaria me ofert[eë]|offer account|kapitulli|chapter)\s*(?:[-/:]\s*)?(.*)$/i),
    offerPositions: findLabeledValue(rows, /^(?:poz\.?\s*me ofert[eë]|pozicionet me ofert[eë]|offer positions)\s*(?:[-/:]\s*)?(.*)$/i),
    sectionTitle: findLabeledValue(rows, /^(?:titulli i seksionit|titulli i kapitullit|section title|chapter title)\s*(?:[-/:]\s*)?(.*)$/i),
  };
}

function isSignatureRow(row: unknown[]): boolean {
  const text = normalizeString(rowText(row));
  return text.includes('kryesi i pun') || text.includes('organi mbikqyr') || text.includes('signature');
}

type ColumnMap = {
  positionCol: number;
  descriptionCol: number;
  unitCol: number;
  qtyCol: number;
  priceCol: number;
  totalCol: number;
};

export type ImportDiagnostic = {
  severity: 'warning';
  sheet_name: string;
  row_number?: number;
  message: string;
};

export type WorkbookMetadataSuggestions = {
  executorName?: string;
  month?: string;
  objectName?: string;
  offerAccount?: string;
  offerPositions?: string;
  sectionTitle?: string;
};

// Fjalëkyçe në shqip DHE serbisht/boshnjakisht — disa paramasa reale (p.sh. nga kontrata të
// vjetra dygjuhëshe) i kanë titujt e kolonave në serbisht ("Opis pozicija", "Kolicina", "Cena",
// "Ukupno"), ose e kanë kolonën shqipe në pozicione të ndryshme (herë e para, herë e dyta pas
// asaj serbisht) — prandaj identifikimi bëhet me fjalëkyçe, jo me indeks fiks të kolonës.
const DESCRIPTION_KEYWORDS = ['pershkrimi', 'shkrimi', 'opis'];
const UNIT_KEYWORDS = ['njesia', 'jedmer', 'jedinica', 'jed.mer', 'jed mer'];
const QTY_KEYWORDS = ['sasia', 'kolicina'];
const PRICE_KEYWORDS = ['cmimi', 'cena'];
const TOTAL_KEYWORDS = ['shuma', 'gjithsej', 'ukupno', 'total'];

/** Gjen kolonat (përshkrim/njësi/sasi/çmim/total) në një rresht header duke kërkuar fjalëkyçe,
 * në vend të indeksit fiks — kjo e bën parsimin të funksionojë pavarësisht gjuhës apo renditjes
 * së kolonave. Kthen null nëse rreshti s'duket si header i vlefshëm (mungon përshkrim/sasi/çmim). */
function detectColumnMap(row: unknown[], situacionContext = false): ColumnMap | null {
  const cells = row.map((cell) => normalizeString(toCellText(cell)));

  const findCols = (keywords: string[], preferred?: string): number[] => {
    if (preferred) {
      const indexes = cells.flatMap((cell, index) => cell.includes(preferred) ? [index] : []);
      if (indexes.length > 0) return indexes;
    }
    return cells.flatMap((cell, index) => keywords.some((keyword) => cell.includes(keyword)) ? [index] : []);
  };

  const positionCol = cells.findIndex((cell) => /^(?:nr|pos|poz|numri|pozicioni)(?:\b|\.|$)/.test(cell) || cell.includes('rendor i pozicionit'));
  const descriptionCol = findCols(DESCRIPTION_KEYWORDS, 'pershkrimi')[0] ?? findCols(DESCRIPTION_KEYWORDS)[0] ?? -1;
  const unitCol = cells.findIndex((cell) =>
    UNIT_KEYWORDS.some((keyword) => cell.includes(keyword)) &&
    !PRICE_KEYWORDS.some((keyword) => cell.includes(keyword)),
  );
  const qtyCols = findCols(QTY_KEYWORDS);
  const priceCols = findCols(PRICE_KEYWORDS).filter((index) => !TOTAL_KEYWORDS.some((keyword) => cells[index].includes(keyword)));
  const totalCols = findCols(TOTAL_KEYWORDS);
  situacionContext ||= cells.some((cell) => cell.includes('situacion') || cell.includes('situation'));
  const qtyCol = qtyCols.length > 1 && situacionContext ? qtyCols[qtyCols.length - 1] : qtyCols[0] ?? -1;
  const priceCol = priceCols[0] ?? -1;
  const totalCol = totalCols.length > 1 && situacionContext ? totalCols[totalCols.length - 1] : totalCols[0] ?? -1;

  // sasia+cmimi janë "spina" e vërtetë e një rreshti header-i të vlefshëm. Kolona e
  // përshkrimit ndonjëherë s'e ka fjalën "përshkrimi"/"opis" fare (p.sh. disa nën-seksione e
  // zëvendësojnë atë qelizë me titullin e vet, si "I. SHPËRNDARJA KABLLORE") — në atë rast,
  // përdorim kolonën menjëherë pas numrit të pozicionit (indeksi 1) si rezervë e arsyeshme,
  // në vend të refuzojmë tërë rreshtin si header i pavlefshëm.
  if (qtyCol === -1 || priceCol === -1) return null;

  return {
    positionCol: positionCol === -1 ? 0 : positionCol,
    descriptionCol: descriptionCol === -1 ? 1 : descriptionCol,
    unitCol,
    qtyCol,
    priceCol,
    totalCol,
  };
}

function extractPositionNumber(text: string): string {
  const value = String(text || '').replace(/^\s*(?:pozicioni|pos\.?|poz\.?)\s*/i, '').trim();
  const match = value.match(/^((?:[IVXLCDM]+|[0-9]+)(?:\.[0-9]+)*)(?=$|[\s.)|:-])/i);
  if (!match) return '';

  const romanRoot = match[1].split('.')[0];
  if (/^[IVXLCDM]+$/i.test(romanRoot) && !/^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i.test(romanRoot)) {
    return '';
  }
  if (/^[IVXLCDM]+$/i.test(romanRoot) && match[1] === romanRoot && value[romanRoot.length] === '.') return '';
  return match[1];
}

function getPositionCell(row: unknown[], columnMap: ColumnMap): string {
  const position = toCellText(row[columnMap.positionCol]);
  if (extractPositionNumber(position)) return position;

  for (let column = 0; column < columnMap.descriptionCol; column += 1) {
    if (column === columnMap.positionCol) continue;
    const candidate = toCellText(row[column]);
    if (candidate.length <= 15 && extractPositionNumber(candidate)) return candidate;
  }
  return '';
}

function findPreviousSectionTitle(rows: unknown[][], headerIndex: number, columnMap: ColumnMap): string {
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 6); index -= 1) {
    const row = rows[index] || [];
    for (let column = 0; column < columnMap.descriptionCol; column += 1) {
      const code = toCellText(row[column]);
      const heading = /^(?:([IVXLCDM]+|\d+)\.\s+)(.+)$/i.exec(code);
      if (heading) return `${heading[1].trim().replace(/\.$/, '').toUpperCase()} ${heading[2]}`.trim();
      if (!/^(?:[IVXLCDM]+|\d+|[A-Z])$/i.test(code)) continue;
      const title = row
        .map((cell, cellIndex) => cellIndex === column ? '' : toCellText(cell))
        .find((value) => value.length > 1 && !extractPositionNumber(value));
      if (title) return `${code.toUpperCase()} ${title}`.trim();
    }
  }
  return '';
}

function hasContinuationAmounts(rows: unknown[][], rowIndex: number, columnMap: ColumnMap): boolean {
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (isEmptyRow(row) || extractPositionNumber(getPositionCell(row, columnMap))) return false;
    if (/^(gjithsejt|totali?|ukupno)\b/.test(normalizeString(rowText(row)))) return false;
    if ([columnMap.qtyCol, columnMap.priceCol, columnMap.totalCol]
      .filter((column) => column >= 0)
      .some((column) => parseNumeric(row[column]) !== 0)) return true;
  }
  return false;
}

function hasFollowingPositionLine(
  rows: unknown[][],
  rowIndex: number,
  columnMap: ColumnMap,
  positionNumber: string,
): boolean {
  for (let index = rowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (isEmptyRow(row)) return false;
    const nextPosition = extractPositionNumber(getPositionCell(row, columnMap));
    if (!nextPosition) continue;
    if (normalizeString(nextPosition) !== normalizeString(positionNumber)) return false;
    return [columnMap.qtyCol, columnMap.priceCol, columnMap.totalCol]
      .filter((column) => column >= 0)
      .some((column) => parseNumeric(row[column]) !== 0);
  }
  return false;
}

function isLikelySectionTitle(value: string): boolean {
  const text = toCellText(value);
  const normalized = normalizeString(text);
  return text.length > 0 &&
    text.length <= 120 &&
    text === text.toLocaleUpperCase() &&
    !/^(?:gjithe?sej|totali?|ukupno|tvsh)\b/.test(normalized);
}

export type NumericParseResult = {
  value: number;
  issue?: string;
};

export function parseNumericWithIssue(value: unknown): NumericParseResult {
  if (typeof value === 'number') return { value: Number.isFinite(value) ? value : 0 };
  let normalized = String(value ?? '')
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[€$£]/g, '');
  if (!normalized) return { value: 0 };
  if (/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(normalized)) {
    const plainNumber = Number(normalized);
    const ambiguous = /^[+-]?\d+\.\d{3}$/.test(normalized);
    return {
      value: Number.isFinite(plainNumber) ? plainNumber : 0,
      issue: ambiguous ? `Formati i numrit "${String(value)}" është i paqartë (ndarës dhjetor ose mijëshe); verifikoje.` : undefined,
    };
  }

  if (!/^[+-]?\d[\d.,]*$/.test(normalized)) {
    return { value: 0, issue: `Vlera numerike nuk u lexua ("${String(value)}").` };
  }
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let ambiguous = false;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = normalized.split(groupingSeparator).join('');
    const decimalIndex = normalized.lastIndexOf(decimalSeparator);
    normalized = `${normalized.slice(0, decimalIndex).split(decimalSeparator).join('')}.${normalized.slice(decimalIndex + 1)}`;
  } else {
    const separator = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (separator) {
      const segments = normalized.split(separator);
      if (segments.length > 2) {
        const isThousandsGrouped = segments.slice(1).every((segment) => segment.length === 3);
        if (isThousandsGrouped) {
          normalized = segments.join('');
        } else {
          const decimal = segments.pop() || '';
          normalized = `${segments.join('')}.${decimal}`;
        }
      } else {
        ambiguous = segments[1]?.length === 3;
        normalized = normalized.replace(separator, '.');
      }
    }
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { value: 0, issue: `Vlera numerike nuk u lexua ("${String(value)}").` };
  }
  return {
    value: parsed,
    issue: ambiguous ? `Formati i numrit "${String(value)}" është i paqartë (ndarës dhjetor ose mijëshe); verifikoje.` : undefined,
  };
}

export function parseNumeric(value: unknown): number {
  return parseNumericWithIssue(value).value;
}

/** Njeh një rresht si "titull i një dokumenti/tabele të re" brenda TË NJËJTIT skedar (p.sh.
 * "PARAMASA E ELEKTRIKES" e ngulitur pas paramasës kryesore të arkitekturës) — kur rreshti
 * ka VETËM NJË qelizë me tekst (gjithçka tjetër bosh) dhe ai tekst përmban "parama". Kjo
 * shenjë përdoret për të mos i lejuar pozicionet e dy dokumenteve të ndryshme (p.sh. "6" nga
 * elektrika dhe "6.1" nga arkitektura) të përzihen në të njëjtin seksion vetëm sepse ndajnë
 * të njëjtin numër rrënjë. */
function isNewDocumentTitleRow(row: unknown[]): boolean {
  const nonEmpty = row.map((cell) => toCellText(cell)).filter((text) => text.trim() !== '');
  const normalized = nonEmpty.map(normalizeString);
  const hasShortTitle = normalized.some((text) => text.includes('parama') && text.length < 120);
  const hasHeaderTerms = normalized.some((text) =>
    [...QTY_KEYWORDS, ...PRICE_KEYWORDS, ...TOTAL_KEYWORDS].some((keyword) => text.includes(keyword)),
  );
  const hasNumericValues = row.some((cell) =>
    typeof cell === 'number' ? Number.isFinite(cell) && cell !== 0 : /^\s*\d+(?:[.,]\d+)?\s*$/.test(toCellText(cell)),
  );
  return hasShortTitle && nonEmpty.length <= 3 && !hasHeaderTerms && !hasNumericValues;
}

function parseStructuredRows(rows: unknown[][], sheetName: string): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  let active = false;
  let columnMap: ColumnMap | null = null;
  let currentSectionLabel = '';
  let tableIndex = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || [];

    if (isNewDocumentTitleRow(row)) {
      // "PARAMASA E ELEKTRIKES" (ose e ngjashme) — fillon një dokument/tabelë krejt tjetër
      // brenda të njëjtit skedar. Rivendos gjithçka që të mos përzihen seksionet.
      tableIndex += 1;
      active = false;
      columnMap = null;
      currentSectionLabel = '';
      continue;
    }

    const context = rows.slice(Math.max(0, index - 3), index + 1).flatMap((cells) => cells.map(toCellText)).join(' ');
    const candidateMap = detectColumnMap(row, /situacion|situation/i.test(context));
    if (candidateMap) {
      active = true;
      columnMap = candidateMap;
      if (!currentSectionLabel) currentSectionLabel = findPreviousSectionTitle(rows, index, columnMap);
      continue;
    }

    if (!active || !columnMap) continue;
    if (isEmptyRow(row)) continue;

    const positionCell = getPositionCell(row, columnMap);
    const positionNumber = extractPositionNumber(positionCell);
    let description = toCellText(row[columnMap.descriptionCol]);

    const sectionHeadingMatch = /^([IVXLCDM]+|\d+)(?:\.(?=\s)|[):|-]|\s+)(.*)$/i.exec(positionCell);
    const sectionToken = sectionHeadingMatch?.[1] || (/^(?:[IVXLCDM]+|\d+)$/i.test(positionCell) ? positionCell : '');
    const inlineSectionTitle = sectionHeadingMatch?.[2]?.replace(/^[|:.)\-\s]+/, '').trim() || '';
    const sectionTitle = inlineSectionTitle || description;
    const noPositionValues = [columnMap.qtyCol, columnMap.priceCol, columnMap.totalCol]
      .filter((column) => column >= 0)
      .every((column) => {
        const value = toCellText(row[column]);
        return !value || (parseNumericWithIssue(row[column]).value === 0 && !parseNumericWithIssue(row[column]).issue);
      });
    const unitValue = columnMap.unitCol >= 0 ? toCellText(row[columnMap.unitCol]) : '';
    if (positionNumber && noPositionValues && !unitValue && hasFollowingPositionLine(rows, index, columnMap, positionNumber)) {
      continue;
    }
    const isRomanSection = /^[IVXLCDM]+$/i.test(positionCell) && Boolean(extractPositionNumber(positionCell));
    const hasContinuation = /^\d+$/.test(positionCell) && noPositionValues && hasContinuationAmounts(rows, index, columnMap);
    if (sectionToken && sectionTitle && noPositionValues && (!unitValue || isRomanSection) && !hasContinuation) {
      currentSectionLabel = `${sectionToken.toUpperCase()} ${sectionTitle}`.trim();
      continue;
    }

    // RËNDËSISHME: kontrollojmë PARA nëse rreshti ka numër pozicioni + përshkrim të vlefshëm.
    // Vetëm nëse S'KA numër pozicioni, e konsiderojmë si rresht "fundi i dokumentit/nënshkrim".
    // Përndryshe, një pozicion i vërtetë me çmim ku përshkrimi përkon rastësisht me frazën e
    // kërkuar për nënshkrimin nuk duhet të ndalë krejt përpunimin (bug i rregulluar më parë).
    if (!positionNumber) {
      const hasAmounts = [columnMap.qtyCol, columnMap.priceCol, columnMap.totalCol]
        .filter((column) => column >= 0)
        .some((column) => parseNumeric(row[column]) !== 0);
      if (!hasAmounts && !unitValue && isLikelySectionTitle(description)) {
        currentSectionLabel = description;
        continue;
      }
      if (isSignatureRow(row)) break;
      continue;
    }

    const quantityParsed = parseNumericWithIssue(row[columnMap.qtyCol]);
    const unitPriceParsed = parseNumericWithIssue(row[columnMap.priceCol]);
    const totalParsed = columnMap.totalCol >= 0 ? parseNumericWithIssue(row[columnMap.totalCol]) : { value: 0 };
    let quantity = quantityParsed.value;
    let unitPrice = unitPriceParsed.value;
    let explicitTotal = totalParsed.value;
    const rowIssues = [quantityParsed.issue, unitPriceParsed.issue, totalParsed.issue].filter((issue): issue is string => Boolean(issue));
    const sourceRow = index + 1;
    let consumedContinuations = 0;

    // Disa paramasa reale e ndajnë një pozicion në disa rreshta: rreshti i parë ka numrin dhe
    // përshkrimin e përgjithshëm por PA sasi/çmim (të gjitha 0), dhe rreshtat TJERË (pa numër
    // pozicioni) kanë nën-përshkrimin (p.sh. "dim. 80/140cm", "dim. 60/60cm" — mund të jenë MË
    // SHUMË se një variant nën të njëjtin pozicion!) DHE sasinë/çmimin e vërtetë. Pa këtë
    // bashkim (të GJITHA rreshtave vazhdues, jo vetëm të parit), çmimi real humbet plotësisht.
    if (quantity === 0 && unitPrice === 0 && explicitTotal === 0) {
      let consumed = 0;
      let mergedTotal = 0;
      let mergedQuantity = 0;
      const extraDescriptions: string[] = [];

      for (let lookahead = index + 1; lookahead < rows.length; lookahead += 1) {
        const nextRow = rows[lookahead] || [];
        if (isEmptyRow(nextRow)) break;
        if (extractPositionNumber(getPositionCell(nextRow, columnMap))) break; // fillon pozicioni tjetër
        if (/^(gjithsejt|totali?|ukupno)\b/.test(normalizeString(rowText(nextRow)))) break; // rresht nën-totali, jo vazhdim

        const nextQty = parseNumeric(nextRow[columnMap.qtyCol]);
        const nextPrice = parseNumeric(nextRow[columnMap.priceCol]);
        const nextTotal = columnMap.totalCol >= 0 ? parseNumeric(nextRow[columnMap.totalCol]) : 0;
        const nextRowTotal = nextTotal || nextQty * nextPrice;
        if (nextQty === 0 && nextPrice === 0 && nextTotal === 0) break; // s'ka të dhëna, ndalo

        mergedTotal += nextRowTotal;
        mergedQuantity += nextQty;
        const nextDescription = toCellText(nextRow[columnMap.descriptionCol]);
        if (nextDescription) extraDescriptions.push(nextDescription);
        consumed += 1;
      }

      if (consumed > 0) {
        explicitTotal = mergedTotal;
        quantity = mergedTotal > 0 ? 1 : mergedQuantity;
        unitPrice = mergedTotal > 0 ? mergedTotal : 0;
        if (extraDescriptions.length > 0) description = `${description} — ${extraDescriptions.join(', ')}`;
        consumedContinuations = consumed;
        index += consumed; // rreshtat vazhdues janë "konsumuar", s'përpunohen përsëri veç
      }
    }

    if (!description || /^(gjithsejt|totali?|ukupno)\b/.test(normalizeString(description))) {
      continue;
    }

    const hasQuantityOrPrice = Boolean(
      toCellText(row[columnMap.qtyCol]) || toCellText(row[columnMap.priceCol]),
    );
    if (!hasQuantityOrPrice && explicitTotal > 0 && !unitValue && consumedContinuations === 0) {
      continue;
    }

    const totalPrice = explicitTotal || quantity * unitPrice;
    if (quantity < 0) rowIssues.push('Sasia është negative; kontrolloje para eksportit.');
    if (quantity === 0 && positionNumber.includes('.')) rowIssues.push('Sasia është zero për një pozicion të numëruar; kontrolloje.');
    if (unitPrice < 0) rowIssues.push('Çmimi për njësi është negativ; kontrolloje para eksportit.');
    if (columnMap.unitCol >= 0 && !toCellText(row[columnMap.unitCol])) rowIssues.push('Mungon njësia matëse.');
    if (columnMap.totalCol >= 0 && explicitTotal > 0) {
      const expectedTotal = quantity * unitPrice;
      const tolerance = Math.max(0.01, Math.abs(explicitTotal) * 0.005);
      if (Math.abs(explicitTotal - expectedTotal) > tolerance) {
        rowIssues.push(`Totali i deklaruar (${explicitTotal}) nuk përputhet me sasi × çmim (${expectedTotal.toFixed(2)}).`);
      }
    }

    parsed.push({
      position_number: positionNumber,
      description,
      unit: columnMap.unitCol >= 0 ? toCellText(row[columnMap.unitCol]) : '',
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      sheet_name: sheetName,
      source_row: sourceRow,
      section_title: currentSectionLabel || undefined,
      table_index: tableIndex,
      issues: rowIssues,
    });
  }

  return parsed;
}

function parseLegacyRows(rows: unknown[][], sheetName: string, diagnostics: ImportDiagnostic[]): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  let headerMap: Record<string, number> | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    if (!headerMap) {
      const tempMap: Record<string, number> = {};
      let matchCount = 0;

      row.forEach((cell, key) => {
        const val = normalizeString(toCellText(cell));
        if (val.includes('nr') || val.includes('numri') || val === 'pos' || val.includes('poz')) {
          tempMap.position = Number(key);
          matchCount += 1;
        } else if (val.includes('pershkrim') || val.includes('emertimi') || val.includes('punet')) {
          tempMap.description = Number(key);
          matchCount += 1;
        } else if (val.includes('njesi')) {
          tempMap.unit = Number(key);
          matchCount += 1;
        } else if (val.includes('sasi')) {
          tempMap.quantity = Number(key);
          matchCount += 1;
        } else if (val.includes('cmim') && !val.includes('total')) {
          tempMap.price = Number(key);
          matchCount += 1;
        }
      });

      if (
        matchCount >= 3 &&
        typeof tempMap.description === 'number' &&
        typeof tempMap.quantity === 'number' &&
        typeof tempMap.price === 'number'
      ) {
        headerMap = tempMap;
      }
      continue;
    }

    const description = toCellText(row[headerMap.description as number]);
    if (!description || normalizeString(description).startsWith('gjithsejt')) {
      const positionValue = toCellText(row[headerMap.position as number] ?? '');
      const quantityValue = toCellText(row[headerMap.quantity as number]);
      const priceValue = toCellText(row[headerMap.price as number]);
      if ((positionValue || quantityValue || priceValue) && !normalizeString(rowText(row)).startsWith('totali')) {
        diagnostics.push({
          severity: 'warning',
          sheet_name: sheetName,
          row_number: rowIndex + 1,
          message: 'Rreshti ka të dhëna por nuk u lidh me një përshkrim pozicioni.',
        });
      }
      continue;
    }

    const quantityParsed = parseNumericWithIssue(row[headerMap.quantity as number]);
    const priceParsed = parseNumericWithIssue(row[headerMap.price as number]);
    const quantity = quantityParsed.value;
    const unitPrice = priceParsed.value;
    const positionNumber = toCellText(row[headerMap.position as number] ?? '');
    const hasNumericInput = Boolean(
      toCellText(row[headerMap.quantity as number]) ||
      toCellText(row[headerMap.price as number]) ||
      positionNumber
    );
    if (!hasNumericInput) continue;
    const rowIssues = [quantityParsed.issue, priceParsed.issue].filter((issue): issue is string => Boolean(issue));
    if (quantity < 0) rowIssues.push('Sasia është negative; kontrolloje para eksportit.');
    if (quantity === 0) rowIssues.push('Sasia është zero për një rresht të importuar; kontrolloje.');
    if (unitPrice < 0) rowIssues.push('Çmimi për njësi është negativ; kontrolloje para eksportit.');
    if (typeof headerMap.unit !== 'number' || !toCellText(row[headerMap.unit])) rowIssues.push('Mungon njësia matëse.');
    if (!positionNumber) rowIssues.push('Numri i pozicionit mungon ose nuk u njoh.');

    parsed.push({
      position_number: positionNumber,
      description,
      unit: toCellText(row[headerMap.unit as number] ?? ''),
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
      sheet_name: sheetName,
      source_row: rowIndex + 1,
      issues: rowIssues,
    });
  }

  return parsed;
}

function libriPositionsToRows(sheetName: string, meta: LibriMeta, positions: ReturnType<typeof parseLibriSheet>['positions']): ParsedRow[] {
  return positions.map((position) => ({
    position_number: position.positionNumber,
    description: position.description,
    unit: position.unit,
    quantity: position.quantity,
    unit_price: 0,
    total_price: 0,
    sheet_name: sheetName,
    source_row: position.sourceRow,
    issues: [
      'Nga Libri Ndërtimor: çmimi nuk vjen nga ky skedar, duhet plotësuar/kombinuar manualisht.',
      ...position.issues,
    ],
    measurements: position.measurements,
    libriMeta: meta,
    source: 'libri',
  }));
}

/** Gjen rreshtin "TOTALI :" (nëse ekziston) dhe kthen shumën që vetë skedari e pretendon si
 * total i përgjithshëm — përdoret si kontroll sigurie: krahasohet me shumën që llogarit vetë
 * sistemi, dhe nëse s'përputhen, do të thotë diçka u la jashtë gjatë parsimit (siç ndodhi më
 * parë me bug-un e "organi mbikëqyrës"). Kontrolli kërkon që kolona e parë e rreshtit të jetë
 * SAKTËSISHT "totali" (me ose pa ":"), jo thjesht fjala "total" diku brenda një fjalie —
 * kjo e bën të sigurt kundër "false positive"-ve, ndryshe nga gabimi i mëparshëm.
 */
function detectDeclaredTotal(rows: unknown[][], preferredTotalCol = -1): number | null {
  const subtotals: number[] = [];
  const totals: number[] = [];

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const matchIndex = row.findIndex((cell) => {
      const label = normalizeString(toCellText(cell)).replace(/:$/, '').trim();
      return /^(?:gjithe?sej|nen\s*totali|subtotal|sub\s*total)$/.test(label) ||
        /^(?:totali?|ukupno)$/.test(label);
    });
    if (matchIndex === -1) continue;

    const label = normalizeString(toCellText(row[matchIndex])).replace(/:$/, '').trim();
    const preferredValue = preferredTotalCol >= 0
      ? parseNumericWithIssue(row[preferredTotalCol])
      : { value: 0 };
    let total = preferredValue.value > 0 && !preferredValue.issue ? preferredValue.value : 0;

    if (total === 0) {
      for (let index = matchIndex + 1; index < row.length; index += 1) {
        const value = toCellText(row[index]);
        if (!value) continue;
        const parsedValue = parseNumericWithIssue(row[index]);
        if (!parsedValue.issue && parsedValue.value > 0) total = parsedValue.value;
        break;
      }
    }

    if (total === 0) continue;
    if (/^(?:gjithe?sej|nen\s*totali|subtotal|sub\s*total)$/.test(label)) subtotals.push(total);
    else totals.push(total);
  }

  return subtotals[subtotals.length - 1] ?? totals[totals.length - 1] ?? null;
}

function findDeclaredTotalColumn(rows: unknown[][]): number {
  let totalCol = -1;
  for (let index = 0; index < rows.length; index += 1) {
    const context = rows.slice(Math.max(0, index - 3), index + 1).flatMap((cells) => cells.map(toCellText)).join(' ');
    const columnMap = detectColumnMap(rows[index] || [], /situacion|situation/i.test(context));
    if (columnMap?.totalCol !== undefined && columnMap.totalCol >= 0) totalCol = columnMap.totalCol;
  }
  return totalCol;
}

export function parseExcelWorkbook(workbook: XLSX.WorkBook): ParseExcelResult {
  const rows: ParsedRow[] = [];
  const diagnostics: ImportDiagnostic[] = [];
  const suggestedMeta: WorkbookMetadataSuggestions = {};
  let declaredTotal: number | null = null;

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });
    const sheetMeta = extractWorkbookMetadata(jsonData);
    Object.entries(sheetMeta).forEach(([key, value]) => {
      if (!suggestedMeta[key as keyof WorkbookMetadataSuggestions] && value) {
        suggestedMeta[key as keyof WorkbookMetadataSuggestions] = value;
      }
    });

    if (isLibriNdertimorSheet(jsonData)) {
      const { meta, positions, issues } = parseLibriSheet(jsonData, sheetName);
      suggestedMeta.executorName ||= meta.executorName;
      suggestedMeta.month ||= meta.month;
      suggestedMeta.objectName ||= meta.objectName;
      suggestedMeta.offerAccount ||= meta.sectionCode || meta.offerAccount;
      suggestedMeta.offerPositions ||= meta.offerPositions;
      suggestedMeta.sectionTitle ||= meta.sectionTitle;
      diagnostics.push(...issues.map((issue) => ({
        severity: 'warning' as const,
        sheet_name: sheetName,
        row_number: issue.rowNumber,
        message: issue.message,
      })));
      if (positions.length > 0) {
        rows.push(...libriPositionsToRows(sheetName, meta, positions).map((row) => ({ ...row, source: 'libri' as const })));
        return;
      }
    }

    const structuredRows = parseStructuredRows(jsonData, sheetName);
    if (structuredRows.length > 0) {
      rows.push(...structuredRows.map((row) => ({ ...row, source: 'paramasa' as const })));
      suggestedMeta.sectionTitle ||= structuredRows.find((row) => row.section_title)?.section_title;
      const sheetDeclaredTotal = detectDeclaredTotal(jsonData, findDeclaredTotalColumn(jsonData));
      if (sheetDeclaredTotal !== null) declaredTotal = (declaredTotal || 0) + sheetDeclaredTotal;
      return;
    }

    rows.push(...parseLegacyRows(jsonData, sheetName, diagnostics).map((row) => ({ ...row, source: 'paramasa' as const })));
  });

  const seenPositions = new Set<string>();
  rows.forEach((row) => {
    const positionNumber = toCellText(row.position_number);
    if (!positionNumber) return;
    const key = [
      row.sheet_name || '',
      row.table_index ?? 0,
      normalizeString(row.section_title || ''),
      normalizeString(positionNumber),
    ].join('|');
    if (seenPositions.has(key)) {
      diagnostics.push({
        severity: 'warning',
        sheet_name: row.sheet_name || '',
        row_number: row.source_row,
        message: `Numri i pozicionit "${positionNumber}" përsëritet brenda të njëjtit seksion/tabelë; verifiko dublikatën.`,
      });
    } else {
      seenPositions.add(key);
    }
  });

  const parsedPositions = [...new Set(rows.map((row) => row.position_number).filter(Boolean))].slice(0, 8);
  if (parsedPositions.length > 0) suggestedMeta.offerPositions = parsedPositions.join(', ');
  suggestedMeta.sectionTitle ||= rows.find((row) => row.section_title)?.section_title;
  return { rows, declaredTotal, diagnostics, suggestedMeta };
}

export type ParseExcelResult = {
  rows: ParsedRow[];
  /** Totali që vetë skedari e pretendon (nëse ka rresht "TOTALI :"), për kontroll sigurie. */
  declaredTotal: number | null;
  diagnostics: ImportDiagnostic[];
  suggestedMeta: WorkbookMetadataSuggestions;
};

/** Njësoj si parseExcel, por kthen edhe totalin e deklaruar nga vetë skedari, për verifikim. */
export async function parseExcelWithValidation(file: File): Promise<ParseExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(parseExcelWorkbook(workbook));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Gabim gjatë leximit të skedarit.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseExcel(file: File): Promise<ParsedRow[]> {
  const result = await parseExcelWithValidation(file);
  return result.rows;
}