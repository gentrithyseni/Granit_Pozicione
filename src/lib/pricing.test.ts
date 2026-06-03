import { describe, it, expect } from 'vitest';
import { calculatePositionPrice } from './pricing';

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
    // material 20 + labor 10 = 30 total
    expect(out.materialTotal).toBe(20);
    expect(out.laborTotal).toBe(10);
    expect(out.subtotal).toBe(30);
    expect(out.total).toBe(30);
    expect(out.unitPrice).toBe(15);
  });
});
