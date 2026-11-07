import { describe, expect, it } from 'vitest';
import { uniqueCategories } from './categories';

describe('uniqueCategories', () => {
  it('shows duplicate category names once and displays the Albanian metal-work name', () => {
    const categories = uniqueCategories([
      { id: 'one', name: 'Pllaka' },
      { id: 'two', name: 'Pllaka' },
      { id: 'legacy', name: 'Metalik & Weld' },
    ]);

    expect(categories).toHaveLength(2);
    expect(categories.map((category) => category.name)).toContain('Metalik & Saldim');
    expect(categories.filter((category) => category.name === 'Pllaka')).toHaveLength(1);
  });
});
