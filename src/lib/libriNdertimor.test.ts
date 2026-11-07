import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseNumericWithIssue, parseExcelWorkbook } from './excel';
import { parseLibriSheet } from './libriNdertimor';
import { groupRowsBySection } from './paramasaPreview';

function makeLibriRows(): unknown[][] {
  return [
    ['Construction Book'],
    ['Kryerësi i punëve Gent'],
    ['Muaji-Month Tetor'],
    ['Objekti-Building: Shkolla'],
    ['Pozicioni i punës - Working positions'],
    ['I Punimet'],
    ['Njësia matëse'],
    ['Masa m3'],
    ['A =', 'B =', 'A+B'],
    ['1.1 Gërmimi'],
    [null, null, null, null, '2 × 3 = 6'],
    [null, null, null, null, '2 x 3 = 7'],
    [null, null, null, null, 'Gjithsejt :', null, null, 4],
    ['2.1 Mbushja'],
    [null, null, null, null, '2 * 3 = 6'],
    [null, null, null, null, 'Gjithsejt :', null, null, 2],
    ['Nënshkrimi'],
  ];
}

describe('parseNumericWithIssue', () => {
  it('interprets mixed locale separators and reports ambiguous single separators', () => {
    expect(parseNumericWithIssue('1.234,56')).toEqual({ value: 1234.56, issue: undefined });
    expect(parseNumericWithIssue('1.234')).toEqual({
      value: 1.234,
      issue: 'Formati i numrit "1.234" është i paqartë (ndarës dhjetor ose mijëshe); verifikoje.',
    });
  });

  it('does not silently treat unparseable text as a valid zero', () => {
    expect(parseNumericWithIssue('n/a')).toEqual({
      value: 0,
      issue: 'Vlera numerike nuk u lexua ("n/a").',
    });
  });
});

describe('parseLibriSheet', () => {
  it('keeps the existing sum-of-A quantity while reporting incorrect and unrecognized measurements', () => {
    const result = parseLibriSheet(makeLibriRows(), 'Libri');

    expect(result.positions).toHaveLength(2);
    expect(result.positions[0].quantity).toBe(4);
    expect(result.positions[0].measurements.map((line) => line.result)).toEqual([6, 7]);
    expect(result.positions[0].issues).toContain(
      'Rreshti 12: rezultati i matjes (7) nuk përputhet me A × B (6.000).'
    );
    expect(result.positions[1].issues).toContain('Rreshti 15: rreshti i matjes nuk u njoh ("2 * 3 = 6").');
  });

  it('returns workbook diagnostics and source row numbers for imported Libri positions', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(makeLibriRows()), 'Libri');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows.map((row) => row.source_row)).toEqual([10, 14]);
    expect(result.rows[0].issues).toContain(
      'Rreshti 12: rezultati i matjes (7) nuk përputhet me A × B (6.000).'
    );
    expect(result.diagnostics.some((issue) => issue.message.includes('metadata'))).toBe(false);
    expect(result.suggestedMeta.objectName).toBe('Shkolla');
    expect(result.suggestedMeta.sectionTitle).toBe('I Punimet');
  });

  it('flags ambiguous numeric values, total inconsistencies, and repeated position numbers', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Nr', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi', 'Totali'],
        ['1.1', 'Punime provë', 'm', '1.234', 2, 1],
        ['1.1', 'Punime provë përsëritur', 'm', 1, 2, 2],
      ]),
      'Paramasa'
    );

    const result = parseExcelWorkbook(workbook);

    expect(result.rows[0].issues?.some((issue) => issue.includes('ndarës dhjetor ose mijëshe'))).toBe(true);
    expect(result.rows[0].issues?.some((issue) => issue.includes('nuk përputhet me sasi × çmim'))).toBe(true);
    expect(result.diagnostics.some((issue) => issue.message.includes('përsëritet'))).toBe(true);
  });

  it('extracts labeled object metadata and chapter headings embedded in a table row', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Objekti-Building: Renovimi i shkollës në Gjakovë'],
        ['Llogaria me ofertë: II'],
        ['Nr', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi', 'Totali'],
        ['2. PUNIMET ELEKTRIKE'],
        ['2.1', 'Vendosja e kabllove', 'm', 10, 2, 20],
      ]),
      'Paramasa'
    );

    const result = parseExcelWorkbook(workbook);

    expect(result.suggestedMeta.objectName).toBe('Renovimi i shkollës në Gjakovë');
    expect(result.suggestedMeta.offerAccount).toBe('II');
    expect(result.rows[0].section_title).toBe('2 PUNIMET ELEKTRIKE');
    expect(groupRowsBySection(result.rows)[0].sectionLabel).toBe('2 PUNIMET ELEKTRIKE');
  });
});
