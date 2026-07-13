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

function isSignatureRow(row: unknown[]): boolean {
  const text = normalizeString(rowText(row));
  return text.includes('kryesi i pun') || text.includes('organi mbikqyr') || text.includes('signature');
}

type ColumnMap = {
  descriptionCol: number;
  unitCol: number;
  qtyCol: number;
  priceCol: number;
  totalCol: number;
};

// Fjalëkyçe në shqip DHE serbisht/boshnjakisht — disa paramasa reale (p.sh. nga kontrata të
// vjetra dygjuhëshe) i kanë titujt e kolonave në serbisht ("Opis pozicija", "Kolicina", "Cena",
// "Ukupno"), ose e kanë kolonën shqipe në pozicione të ndryshme (herë e para, herë e dyta pas
// asaj serbisht) — prandaj identifikimi bëhet me fjalëkyçe, jo me indeks fiks të kolonës.
const DESCRIPTION_KEYWORDS = ['pershkrimi', 'opis'];
const UNIT_KEYWORDS = ['njesia', 'jedmer', 'jedinica', 'jed.mer', 'jed mer'];
const QTY_KEYWORDS = ['sasia', 'kolicina'];
const PRICE_KEYWORDS = ['cmimi', 'cena'];
const TOTAL_KEYWORDS = ['shuma', 'gjithsej', 'ukupno', 'total'];

/** Gjen kolonat (përshkrim/njësi/sasi/çmim/total) në një rresht header duke kërkuar fjalëkyçe,
 * në vend të indeksit fiks — kjo e bën parsimin të funksionojë pavarësisht gjuhës apo renditjes
 * së kolonave. Kthen null nëse rreshti s'duket si header i vlefshëm (mungon përshkrim/sasi/çmim). */
function detectColumnMap(row: unknown[]): ColumnMap | null {
  const cells = row.map((cell) => normalizeString(toCellText(cell)));

  const findCol = (keywords: string[], preferred?: string): number => {
    if (preferred) {
      const idx = cells.findIndex((c) => c.includes(preferred));
      if (idx >= 0) return idx;
    }
    for (const kw of keywords) {
      const idx = cells.findIndex((c) => c.includes(kw));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const descriptionCol = findCol(DESCRIPTION_KEYWORDS, 'pershkrimi');
  const unitCol = findCol(UNIT_KEYWORDS);
  const qtyCol = findCol(QTY_KEYWORDS);
  const priceCol = findCol(PRICE_KEYWORDS);
  const totalCol = findCol(TOTAL_KEYWORDS);

  // sasia+cmimi janë "spina" e vërtetë e një rreshti header-i të vlefshëm. Kolona e
  // përshkrimit ndonjëherë s'e ka fjalën "përshkrimi"/"opis" fare (p.sh. disa nën-seksione e
  // zëvendësojnë atë qelizë me titullin e vet, si "I. SHPËRNDARJA KABLLORE") — në atë rast,
  // përdorim kolonën menjëherë pas numrit të pozicionit (indeksi 1) si rezervë e arsyeshme,
  // në vend të refuzojmë tërë rreshtin si header i pavlefshëm.
  if (qtyCol === -1 || priceCol === -1) return null;

  return { descriptionCol: descriptionCol === -1 ? 1 : descriptionCol, unitCol, qtyCol, priceCol, totalCol };
}

function extractPositionNumber(text: string): string {
  const match = String(text || '').match(/^\s*([0-9]+(?:\.[0-9]+)*)\b/);
  return match ? match[1] : '';
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Njeh një rresht si "titull i një dokumenti/tabele të re" brenda TË NJËJTIT skedar (p.sh.
 * "PARAMASA E ELEKTRIKES" e ngulitur pas paramasës kryesore të arkitekturës) — kur rreshti
 * ka VETËM NJË qelizë me tekst (gjithçka tjetër bosh) dhe ai tekst përmban "parama". Kjo
 * shenjë përdoret për të mos i lejuar pozicionet e dy dokumenteve të ndryshme (p.sh. "6" nga
 * elektrika dhe "6.1" nga arkitektura) të përzihen në të njëjtin seksion vetëm sepse ndajnë
 * të njëjtin numër rrënjë. */
function isNewDocumentTitleRow(row: unknown[]): boolean {
  const nonEmpty = row.map((cell) => toCellText(cell)).filter((text) => text.trim() !== '');
  if (nonEmpty.length !== 1) return false;
  const normalized = normalizeString(nonEmpty[0]);
  return normalized.includes('parama') && normalized.length < 60;
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

    const candidateMap = detectColumnMap(row);
    if (candidateMap) {
      active = true;
      columnMap = candidateMap;
      continue;
    }

    if (!active || !columnMap) continue;
    if (isEmptyRow(row)) continue;

    const positionNumber = extractPositionNumber(toCellText(row[0]));
    let description = toCellText(row[columnMap.descriptionCol]);

    // Rreshti i titullit të seksionit (p.sh. "II | PUNËT E DEMOLIMIT") — kolona A ka numër
    // romak, jo arab, prandaj s'ka positionNumber. E ruajmë si kontekst për pozicionet
    // pasuese, në vend ta hedhim poshtë.
    if (!positionNumber && description && /^[IVXLCDM]+\s*$/i.test(toCellText(row[0]))) {
      currentSectionLabel = `${toCellText(row[0])} ${description}`.trim();
      continue;
    }

    // RËNDËSISHME: kontrollojmë PARA nëse rreshti ka numër pozicioni + përshkrim të vlefshëm.
    // Vetëm nëse S'KA numër pozicioni, e konsiderojmë si rresht "fundi i dokumentit/nënshkrim".
    // Përndryshe, një pozicion i vërtetë me çmim ku përshkrimi përkon rastësisht me frazën e
    // kërkuar për nënshkrimin nuk duhet të ndalë krejt përpunimin (bug i rregulluar më parë).
    if (!positionNumber) {
      if (isSignatureRow(row)) break;
      continue;
    }

    let quantity = parseNumeric(row[columnMap.qtyCol]);
    let unitPrice = parseNumeric(row[columnMap.priceCol]);
    let explicitTotal = columnMap.totalCol >= 0 ? parseNumeric(row[columnMap.totalCol]) : 0;

    // Disa paramasa reale e ndajnë një pozicion në disa rreshta: rreshti i parë ka numrin dhe
    // përshkrimin e përgjithshëm por PA sasi/çmim (të gjitha 0), dhe rreshtat TJERË (pa numër
    // pozicioni) kanë nën-përshkrimin (p.sh. "dim. 80/140cm", "dim. 60/60cm" — mund të jenë MË
    // SHUMË se një variant nën të njëjtin pozicion!) DHE sasinë/çmimin e vërtetë. Pa këtë
    // bashkim (të GJITHA rreshtave vazhdues, jo vetëm të parit), çmimi real humbet plotësisht.
    if (quantity === 0 && unitPrice === 0 && explicitTotal === 0) {
      let consumed = 0;
      let mergedTotal = 0;
      const extraDescriptions: string[] = [];

      for (let lookahead = index + 1; lookahead < rows.length; lookahead += 1) {
        const nextRow = rows[lookahead] || [];
        if (isEmptyRow(nextRow)) break;
        if (extractPositionNumber(toCellText(nextRow[0]))) break; // fillon pozicioni tjetër
        if (/^(gjithsejt|totali?|ukupno)\b/.test(normalizeString(rowText(nextRow)))) break; // rresht nën-totali, jo vazhdim

        const nextQty = parseNumeric(nextRow[columnMap.qtyCol]);
        const nextPrice = parseNumeric(nextRow[columnMap.priceCol]);
        const nextTotal = columnMap.totalCol >= 0 ? parseNumeric(nextRow[columnMap.totalCol]) : 0;
        const nextRowTotal = nextTotal || nextQty * nextPrice;
        if (nextQty === 0 && nextPrice === 0 && nextTotal === 0) break; // s'ka të dhëna, ndalo

        mergedTotal += nextRowTotal;
        const nextDescription = toCellText(nextRow[columnMap.descriptionCol]);
        if (nextDescription) extraDescriptions.push(nextDescription);
        consumed += 1;
      }

      if (consumed > 0) {
        explicitTotal = mergedTotal;
        quantity = 1;
        unitPrice = mergedTotal;
        if (extraDescriptions.length > 0) description = `${description} — ${extraDescriptions.join(', ')}`;
        index += consumed; // rreshtat vazhdues janë "konsumuar", s'përpunohen përsëri veç
      }
    }

    if (!description || /^(gjithsejt|totali?|ukupno)\b/.test(normalizeString(description))) {
      continue;
    }

    const totalPrice = explicitTotal || quantity * unitPrice;

    parsed.push({
      position_number: positionNumber,
      description,
      unit: columnMap.unitCol >= 0 ? toCellText(row[columnMap.unitCol]) : '',
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      sheet_name: sheetName,
      section_title: currentSectionLabel || undefined,
      table_index: tableIndex,
      issues: [],
    });
  }

  return parsed;
}

function parseLegacyRows(rows: unknown[][], sheetName: string): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  let headerMap: Record<string, number> | null = null;

  for (const row of rows) {
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

      if (matchCount >= 3) {
        headerMap = tempMap;
      }
      continue;
    }

    const description = toCellText(row[headerMap.description as number]);
    if (!description || normalizeString(description).startsWith('gjithsejt')) continue;

    const quantity = parseNumeric(row[headerMap.quantity as number]);
    const unitPrice = parseNumeric(row[headerMap.price as number]);
    if (quantity <= 0) continue;

    const positionNumber = toCellText(row[headerMap.position as number] ?? '');
    parsed.push({
      position_number: positionNumber,
      description,
      unit: toCellText(row[headerMap.unit as number] ?? 'copë'),
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
      sheet_name: sheetName,
      issues: [],
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
    issues: ['Nga Libri Ndërtimor: çmimi nuk vjen nga ky skedar, duhet plotësuar/kombinuar manualisht.'],
    measurements: position.measurements,
    libriMeta: meta,
    source: 'libri',
  }));
}

function dedupeRows(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Set<string>();
  const result: ParsedRow[] = [];

  rows.forEach((row) => {
    // çelës identiteti: pozicion + përshkrim + sasi + çmim njësi. Nëse KATËR këto përputhen
    // saktësisht me një rresht të parë, është praktikisht i sigurt që është dublikatë (nga një
    // fletë tjetër/rezervë e të njëjtit skedar), jo dy pozicione të ndryshme rastësisht identike.
    const key = [
      normalizeString(row.position_number),
      normalizeString(row.description),
      Number(row.quantity || 0).toFixed(2),
      Number(row.unit_price || 0).toFixed(2),
    ].join('|');

    if (seen.has(key)) return;
    seen.add(key);
    result.push(row);
  });

  return result;
}

/** Gjen rreshtin "TOTALI :" (nëse ekziston) dhe kthen shumën që vetë skedari e pretendon si
 * total i përgjithshëm — përdoret si kontroll sigurie: krahasohet me shumën që llogarit vetë
 * sistemi, dhe nëse s'përputhen, do të thotë diçka u la jashtë gjatë parsimit (siç ndodhi më
 * parë me bug-un e "organi mbikëqyrës"). Kontrolli kërkon që kolona e parë e rreshtit të jetë
 * SAKTËSISHT "totali" (me ose pa ":"), jo thjesht fjala "total" diku brenda një fjalie —
 * kjo e bën të sigurt kundër "false positive"-ve, ndryshe nga gabimi i mëparshëm.
 */
function detectDeclaredTotal(rows: unknown[][]): number | null {
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const matchIndex = row.findIndex((cell) => /^(totali?|ukupno)\s*:?$/.test(normalizeString(toCellText(cell))));
    if (matchIndex === -1) continue;

    const numericValues = row
      .map((cell) => (typeof cell === 'number' ? cell : null))
      .filter((v): v is number => v !== null && v > 0);

    if (numericValues.length > 0) {
      return Math.max(...numericValues);
    }
  }
  return null;
}

function parseWorkbook(workbook: XLSX.WorkBook): { rows: ParsedRow[]; declaredTotal: number | null } {
  const rows: ParsedRow[] = [];
  let declaredTotal: number | null = null;

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });

    if (isLibriNdertimorSheet(jsonData)) {
      const { meta, positions } = parseLibriSheet(jsonData, sheetName);
      if (positions.length > 0) {
        rows.push(...libriPositionsToRows(sheetName, meta, positions).map((row) => ({ ...row, source: 'libri' as const })));
        return;
      }
    }

    const structuredRows = parseStructuredRows(jsonData, sheetName);
    if (structuredRows.length > 0) {
      rows.push(...structuredRows.map((row) => ({ ...row, source: 'paramasa' as const })));
      const sheetDeclaredTotal = detectDeclaredTotal(jsonData);
      if (sheetDeclaredTotal !== null) declaredTotal = (declaredTotal || 0) + sheetDeclaredTotal;
      return;
    }

    rows.push(...parseLegacyRows(jsonData, sheetName).map((row) => ({ ...row, source: 'paramasa' as const })));
  });

  return { rows: dedupeRows(rows), declaredTotal };
}

export type ParseExcelResult = {
  rows: ParsedRow[];
  /** Totali që vetë skedari e pretendon (nëse ka rresht "TOTALI :"), për kontroll sigurie. */
  declaredTotal: number | null;
};

/** Njësoj si parseExcel, por kthen edhe totalin e deklaruar nga vetë skedari, për verifikim. */
export async function parseExcelWithValidation(file: File): Promise<ParseExcelResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(parseWorkbook(workbook));
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