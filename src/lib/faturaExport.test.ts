import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { buildKontrateWorkbook, buildPozicioneWorkbook } from './faturaExport';
import { createKontrateDefaults, createPozicioneDefaults } from '../types/fatura';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildKontrateWorkbook', () => {
  it('keeps the A4 print area and recipient borders correct', async () => {
    const template = await readFile(new URL('../../public/templates/Fatura - Shabllon - Kontrate.xlsx', import.meta.url));
    const templateBuffer = template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(templateBuffer)));

    const buffer = await buildKontrateWorkbook({
      ...createKontrateDefaults(),
      clientName: 'Institucioni testues',
      clientAddress: 'Adresa testuese',
      totalWithVat: '100',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.pageSetup.printArea).toBe('A1:K44');
    expect(worksheet.pageSetup.fitToHeight).toBe(1);
    expect(worksheet.getCell('H12').border.top).toBeUndefined();
    expect(worksheet.getCell('H12').border.left?.style).toBe('medium');
    expect(worksheet.getCell('K12').border.right?.style).toBe('medium');
    expect(worksheet.getCell('H16').isMerged).toBe(true);
    expect(worksheet.getCell('K16').isMerged).toBe(true);
    expect(worksheet.getCell('K16').master.address).toBe('H16');
    expect(worksheet.getCell('K16').border.right?.style).toBe('medium');
    expect(worksheet.getCell('H16').border.bottom?.style).toBe('medium');
    expect(worksheet.getCell('A27').border.top?.style).toBe('medium');
    expect(worksheet.getCell('J36').border.bottom?.style).toBe('medium');
    expect(worksheet.getCell('H27').border.left?.style).toBe('medium');
    expect(worksheet.getCell('I31').border.left?.style).toBe('medium');
    expect(worksheet.getCell('J31').border.left?.style).toBe('medium');
    expect(worksheet.getCell('J31').border.right?.style).toBe('medium');
    expect(worksheet.getCell('E30').border.right).toBeUndefined();
    expect(worksheet.getCell('F30').border.left?.style).toBe('thin');
    expect(worksheet.getCell('E36').border.right).toBeUndefined();
    expect(worksheet.getCell('F36').border.left?.style).toBe('thin');
    expect(String(worksheet.getCell('A44').value)).toMatch(/^_{10,}/);
  });
});

describe('buildPozicioneWorkbook', () => {
  it('does not draw a line directly below the recipient label', async () => {
    const template = await readFile(new URL('../../public/templates/Fletedergese-Shabllon-Pozicione.xlsx', import.meta.url));
    const templateBuffer = template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(templateBuffer)));

    const buffer = await buildPozicioneWorkbook({
      ...createPozicioneDefaults(),
      clientName: 'Institucioni testues',
      clientAddress: 'Adresa testuese',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    expect(worksheet.getCell('G13').border.top).toBeUndefined();
    expect(worksheet.getCell('G13').border.left?.style).toBe('medium');
    expect(worksheet.getCell('J13').border.right?.style).toBe('medium');
    expect(worksheet.getCell('G17').border.bottom?.style).toBe('medium');
  });
});
