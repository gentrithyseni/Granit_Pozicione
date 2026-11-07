import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelWorkbook, parseNumeric } from './excel';

describe('parseNumeric', () => {
  it('parses European numbers with thousands and decimal separators', () => {
    expect(parseNumeric('1.234,56')).toBe(1234.56);
    expect(parseNumeric('1 234,56 €')).toBe(1234.56);
    expect(parseNumeric('1,234.56')).toBe(1234.56);
  });

  it('does not round or coerce valid precise values', () => {
    expect(parseNumeric('2.004')).toBe(2.004);
    expect(parseNumeric('1.234.567')).toBe(1234567);
  });
});

describe('parseExcelWorkbook', () => {
  it('preserves identical positions in different sheets and duplicate-looking rows', () => {
    const workbook = XLSX.utils.book_new();
    const sheetRows = [
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi për njësi', 'Totali'],
      ['1', 'Punim identik', 'm2', 2, 10, 20],
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), 'Paramasa 1');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows), 'Paramasa 2');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.sheet_name)).toEqual(['Paramasa 1', 'Paramasa 2']);
  });

  it('reads European-formatted quantity, price, and total values stored as text', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi për njësi', 'Totali'],
      ['1', 'Punim', 'm2', '1.234,56', '2,50', '3.086,40'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      quantity: 1234.56,
      unit_price: 2.5,
      total_price: 3086.4,
    });
  });

  it('keeps unpriced positions with Roman-numbered identifiers and groups them by section', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['I', 'PLATFORMA PËR PERSONAT ME AFTËSI TË VEÇANTA'],
      ['Pos.', 'PËRSHKRIMI I PUNËVE', null, null, 'NJËSIA', 'SASIA', 'ÇMIMI/NJËSI', 'SHUMA'],
      ['I.1', 'Përgatitja e hapësirës', null, null, 'komp.', 1, 0, 0],
      ['II', 'KUZHINA E ÇERDHES'],
      ['Pos.', 'PËRSHKRIMI I PUNËVE', null, null, 'NJËSIA', 'SASIA', 'ÇMIMI/NJËSI', 'SHUMA'],
      ['II.1', 'Demolimi i murit ekzistues', null, null, 'm²', 18.9, 0, 0],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.position_number)).toEqual(['I.1', 'II.1']);
    expect(result.rows.map((row) => row.section_title)).toEqual([
      'I PLATFORMA PËR PERSONAT ME AFTËSI TË VEÇANTA',
      'II KUZHINA E ÇERDHES',
    ]);
    expect(result.rows.map((row) => row.total_price)).toEqual([0, 0]);
  });

  it('merges priced continuation rows under the numbered position', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi për njësi', 'Totali'],
      ['10.4', 'Blerja dhe montimi i dritareve PVC', null, null, null, null],
      [null, 'dim. 80/140cm', 'copë', 2, 150, 300],
      [null, 'dim. 60/60cm', 'copë', 1, 85, 85],
      [null, 'TOTALI', null, null, null, 385],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      position_number: '10.4',
      quantity: 1,
      unit_price: 385,
      total_price: 385,
    });
    expect(result.rows[0].description).toContain('dim. 80/140cm');
    expect(result.rows[0].description).toContain('dim. 60/60cm');
  });

  it('does not import a repeated Roman-numbered chapter label as a position', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['IV', 'PUNËT E HIDROINSTALIMEVE'],
      ['Pos.', 'PËRSHKRIMI', 'NJËSIA', 'SASIA', 'ÇMIMI/NJËSI', 'SHUMA'],
      ['IV.1', 'Punët e Hidroinstalimeve'],
      ['IV.1', 'Rivendosja e lavamanëve', 'copë', 3, 5, 15],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ position_number: 'IV.1', total_price: 15 });
    expect(result.diagnostics).toHaveLength(0);
  });

  it('separates embedded price schedules even when their title shares a row with a section code', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi'],
      [1, 'Pozicioni i parë', 'm²', 1, 10],
      ['C', 'PARAMASA E INSTALIMEVE'],
      ['I', 'PUNËT ELEKTRIKE'],
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi'],
      [1, 'Pozicioni i dytë', 'm²', 1, 20],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows.map((row) => row.position_number)).toEqual(['1', '1']);
    expect(result.rows.map((row) => row.table_index)).toEqual([0, 1]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('scopes repeated simple position numbers to their uppercase section headings', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nr.', 'Titulli', 'Çmimi për njësi', 'Sasia', 'Njësia matëse', 'Totali'],
      [null, 'ADAPTIMI I TUALETEVE TEK SHKOLLA', null, null, null, null],
      [1, 'Montimi i derës', 350, 1, 'copë', 350],
      [null, 'ADAPTIMI I TUALETEVE TEK ARKIVA', null, null, null, null],
      [1, 'Demontimi i elementeve sanitare', 30, 1, 'paushall', 30],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Situacioni');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.section_title)).toEqual([
      'ADAPTIMI I TUALETEVE TEK SHKOLLA',
      'ADAPTIMI I TUALETEVE TEK ARKIVA',
    ]);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('finds position identifiers in an adjacent column and skips total-only recap rows', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Nr. i Pos.', null, 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi pa TVSH', 'Vlera'],
      [null, 1, 'Demolimi i murit', 'komplet', 1, 185, 185],
      [null, 2, 'Montimi i derës', 'komplet', 1, 87, 87],
      [null, null, 'Totali:', null, null, null, 272],
      [1, null, 'PUNËT E DEMOLIMIT', null, null, null, 185],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows.map((row) => row.position_number)).toEqual(['1', '2']);
    expect(result.rows.reduce((sum, row) => sum + row.total_price, 0)).toBe(272);
  });

  it('uses the active situation columns and compares the matching pre-tax subtotal', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [null, null, null, null, null, null, 'SITUACIONI I PARË I PËRKOHSHËM'],
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi', 'Shuma', 'Sasia', 'Shuma'],
      [1, 'Punimi i parë', 'm²', 10, 10, 100, 4, 40],
      [null, null, null, null, 'GJITHËSEJ:', 100, null, 40],
      [null, null, null, null, 'TVSH 18%', 18, null, 7.2],
      [null, null, null, null, 'TOTALI', 118, null, 47.2],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Situacioni');

    const result = parseExcelWorkbook(workbook);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ quantity: 4, unit_price: 10, total_price: 40 });
    expect(result.declaredTotal).toBe(40);
  });

  it('uses the object name after a numbered project label and rejects prose as contractor metadata', () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Projekti 1:'],
      ['Renovimi i objektit të shkollës'],
      ['Kontraktori do të jetë përgjegjës për sigurinë në punishte.'],
      ['Nr.', 'Përshkrimi', 'Njësia', 'Sasia', 'Çmimi'],
      [1, 'Punim', 'm²', 1, 10],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Paramasa');

    const result = parseExcelWorkbook(workbook);

    expect(result.suggestedMeta.objectName).toBe('Renovimi i objektit të shkollës');
    expect(result.suggestedMeta.executorName).toBeUndefined();
  });
});
