import { describe, expect, it } from 'vitest';
import { formatDateTime } from './dates';

describe('formatDateTime', () => {
  it('uses a 24-hour clock without an AM/PM marker', () => {
    const formatted = formatDateTime('2026-10-13T08:36:00');
    expect(formatted).not.toMatch(/m\.d\./i);
    expect(formatted).toMatch(/\b\d{2}:\d{2}\b/);
  });
});
