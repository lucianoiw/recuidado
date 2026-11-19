import { describe, expect, it } from 'vitest';
import { monthlyCostOf } from './pricing.js';

const price = { monthlyCents: 18_000, monthlyMaxCents: 20_000, packCents: 30_000, unitsPerPack: 50, product: 'X', listDate: null };

describe('monthlyCostOf', () => {
  it('uses the CMED month without a discount', () => {
    expect(monthlyCostOf(0, price as never)).toBe(18_000);
  });

  it('uses the price the family pays per pack for a month of doses', () => {
    // R$ 150 for 50 pills, 2 a day: 60 pills a month = R$ 180.
    expect(monthlyCostOf(0, price as never, { packCents: 15_000, dosesPerDay: 2 })).toBe(18_000);
    expect(monthlyCostOf(0, price as never, { packCents: 10_000, dosesPerDay: 1 })).toBe(6_000);
  });

  it('falls back to CMED when the pack size is unknown or there are no times', () => {
    expect(monthlyCostOf(0, null, { packCents: 10_000, dosesPerDay: 1 })).toBe(0);
    expect(monthlyCostOf(0, price as never, { packCents: 10_000, dosesPerDay: 0 })).toBe(18_000);
    expect(monthlyCostOf(0, price as never, { packCents: null, dosesPerDay: 2 })).toBe(18_000);
  });
});
