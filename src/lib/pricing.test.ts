import { describe, it, expect } from 'vitest';
import { calculatePositionPrice } from './pricing';
import { packSectionIntoPages } from './libriPaging';
import { buildLibriNdertimorWorkbook, planLibriExport } from './libriExport';
import { groupRowsBySection } from './paramasaPreview';
import type { ParsedRow } from './excel';

const makeRow = (overrides: Partial<ParsedRow> = {}): ParsedRow => ({
  position_number: '1',
  description: 'Përshkrim bazë',
  unit: 'm2',
  quantity: 1,
  unit_price: 10,
  total_price: 10,
  section_title: 'I. Punimet e demolit',
  table_index: 0,
  ...overrides,
});

describe('calculatePositionPrice', () => {
  it('calculates totals correctly for simple input', () => {
    const input = {
      quantity: 2,
      materialPrice: 10,
      laborPrice: 5,
      days: 1,
      foodPrice: 0,
      transportPrice: 0,
      otherPrice: 0,
      profitPercent: 0,
      vatPercent: 0,
    };
    const out = calculatePositionPrice(input);
    expect(out.materialTotal).toBe(20);
    expect(out.laborTotal).toBe(10);
    expect(out.subtotal).toBe(30);
    expect(out.total).toBe(30);
    expect(out.unitPrice).toBe(15);
  });
});

describe('packSectionIntoPages', () => {
  it('keeps very long descriptions on separate pages instead of grouping them together', () => {
    const longText = 'Përshkrim i gjatë dhe shumë i detajuar për punimet në objekt, me sasi, material, trajtim sipërfaqe, mbrojtje, kontroll, verifikim dhe dokumentim të plotë. '.repeat(20);
    const rows = Array.from({ length: 5 }, (_, index) =>
      makeRow({
        position_number: `${index + 1}`,
        description: `${longText} Pozicioni ${index + 1}`,
      })
    );

    const plan = packSectionIntoPages(rows);

    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((page) => page.rows.length <= 1)).toBe(true);
  });
});

describe('groupRowsBySection', () => {
  it('keeps different section roots separate even when the number patterns are similar', () => {
    const rows = [
      makeRow({ position_number: '4.1', description: 'Pune e parë', section_title: 'IV. Punimi i strukturës' }),
      makeRow({ position_number: '4.2', description: 'Pune e dytë', section_title: 'IV. Punimi i strukturës' }),
      makeRow({ position_number: '5.1', description: 'Pune e tretë', section_title: 'V. Mbrojtja e mjedisit' }),
      makeRow({ position_number: '5.2', description: 'Pune e katërt', section_title: 'V. Mbrojtja e mjedisit' }),
    ];

    const sections = groupRowsBySection(rows);

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.sectionLabel)).toEqual(
      expect.arrayContaining(['IV. Punimi i strukturës', 'V. Mbrojtja e mjedisit'])
    );
  });
});

describe('planLibriExport', () => {
  it('creates separate pages for different sections and keeps page count consistent', () => {
    const rows = [
      makeRow({ position_number: '1', description: 'Pune 1', section_title: 'I. Punimet e demolit' }),
      makeRow({ position_number: '2', description: 'Pune 2', section_title: 'I. Punimet e demolit' }),
      makeRow({ position_number: '3', description: 'Pune 3', section_title: 'II. Funksionet bazë' }),
      makeRow({ position_number: '4', description: 'Pune 4', section_title: 'II. Funksionet bazë' }),
    ];

    const plan = planLibriExport(rows);

    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(new Set(plan.map((page) => page.sectionLabel)).size).toBeGreaterThanOrEqual(2);
  });

  it('does not group multiple long rows into the same page when a single row already exceeds capacity', () => {
    const longText = 'Përshkrim i gjatë dhe i detajuar për punimet e objektit, kontroll, dokumentim, sigurim, bashkim dhe verifikim me standardet e duhura. '.repeat(18);
    const rows = [
      makeRow({ position_number: '1', description: longText, section_title: 'III. Punimet e ndërtimit' }),
      makeRow({ position_number: '2', description: longText, section_title: 'III. Punimet e ndërtimit' }),
      makeRow({ position_number: '3', description: longText, section_title: 'III. Punimet e ndërtimit' }),
    ];

    const plan = planLibriExport(rows);

    expect(plan.every((page) => page.rows.length <= 1)).toBe(true);
  });
});

describe('Libri export workflow', () => {
  it('can generate a real workbook buffer from a valid plan', async () => {
    const rows = [
      makeRow({
        position_number: '1',
        description: 'Punim i thjeshtë i shtëpisë',
        section_title: 'I. Punimet e demolit',
        quantity: 10,
        unit_price: 15,
        total_price: 150,
      }),
      makeRow({
        position_number: '2',
        description: 'Punim i dytë i shtëpisë',
        section_title: 'I. Punimet e demolit',
        quantity: 4,
        unit_price: 12,
        total_price: 48,
      }),
    ];

    const meta = {
      executorName: 'Megrant ING SH.P.K',
      month: 'Korrik 2026',
      date: '31.08.2026',
      objectName: 'Objekti Test',
      offerAccount: 'No 01/2026',
      offerPositions: '1, 2',
      sectionTitle: 'I. Punimet e demolit',
    };

    const buffer = await buildLibriNdertimorWorkbook(rows, meta);

    expect(buffer instanceof ArrayBuffer).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
