import { describe, expect, it } from 'vitest';
import type { ParsedRow } from './excel';
import {
  restoreLibriExportPlan,
  serializeLibriExportPlan,
  type LibriExportPlanPage,
} from './libriExportPlan';

function makeRow(position: string): ParsedRow {
  return {
    position_number: position,
    description: `Punimi ${position}`,
    unit: 'm2',
    quantity: 1,
    unit_price: 10,
    total_price: 10,
  };
}

describe('manual Libri export page layout persistence', () => {
  it('restores the same page count, order, and row assignments', () => {
    const rows = [makeRow('1.1'), makeRow('1.2'), makeRow('1.3')];
    const manualPlan: LibriExportPlanPage[] = [
      {
        templateId: 2,
        sectionKey: '1',
        sectionLabel: '1. Punët',
        rows: [rows[0], rows[2]],
        overflowWarning: false,
        mixedUnitsWarning: false,
      },
      {
        templateId: 1,
        sectionKey: '1',
        sectionLabel: '1. Punët - vazhdim',
        rows: [rows[1]],
        overflowWarning: false,
        mixedUnitsWarning: false,
      },
    ];

    const serialized = serializeLibriExportPlan(manualPlan, rows);
    const restored = restoreLibriExportPlan(serialized, rows);

    expect(restored).toHaveLength(2);
    expect(restored?.map((page) => page.rows.map((row) => row.position_number))).toEqual([
      ['1.1', '1.3'],
      ['1.2'],
    ]);
    expect(restored?.map((page) => page.sectionLabel)).toEqual(['1. Punët', '1. Punët - vazhdim']);
  });

  it('rejects incomplete, duplicate, or invalid stored page assignments', () => {
    const rows = [makeRow('1.1'), makeRow('1.2')];
    const incompletePlan: LibriExportPlanPage[] = [{
      templateId: 1,
      sectionKey: '1',
      sectionLabel: '1. Punët',
      rows: [rows[0]],
      overflowWarning: false,
      mixedUnitsWarning: false,
    }];

    expect(serializeLibriExportPlan(incompletePlan, rows)).toBeNull();
    expect(restoreLibriExportPlan([
      { templateId: 1, sectionKey: '1', sectionLabel: '1.', rowIndexes: [0, 0] },
    ], rows)).toBeNull();
    expect(restoreLibriExportPlan([
      { templateId: 6, sectionKey: '1', sectionLabel: '1.', rowIndexes: [0, 1] },
    ], rows)).toBeNull();
  });
});
