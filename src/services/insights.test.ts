import { describe, expect, it } from 'vitest';
import { buildMonthlyOfferTrend } from './insights';

describe('buildMonthlyOfferTrend', () => {
  it('groups a project by its creation month, counts offers rather than positions, and includes empty months', () => {
    const trend = buildMonthlyOfferTrend(
      [
        {
          created_at: '2026-10-08T12:00:00',
          project_items: [{ total_price: 100 }, { total_price: 50 }],
        },
        {
          created_at: '2026-09-02T12:00:00',
          project_items: [{ total_price: 200 }],
        },
        {
          created_at: '2026-03-31T12:00:00',
          project_items: [{ total_price: 900 }],
        },
      ],
      new Date(2026, 9, 13)
    );

    expect(trend.map((point) => point.month)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(trend.find((point) => point.month === '2026-10')).toMatchObject({
      total: 150,
      count: 1,
      positionCount: 2,
      average: 150,
    });
    expect(trend.find((point) => point.month === '2026-09')).toMatchObject({
      total: 200,
      count: 1,
      positionCount: 1,
    });
    expect(trend.find((point) => point.month === '2026-08')).toMatchObject({
      total: 0,
      count: 0,
      positionCount: 0,
      average: 0,
    });
  });
});
