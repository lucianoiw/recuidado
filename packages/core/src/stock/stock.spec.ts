import { describe, expect, it } from 'vitest';
import { lowStockText, stockStatus } from './stock.js';

describe('stockStatus', () => {
  it('subtracts the confirmed doses and counts whole days', () => {
    expect(stockStatus({ counted: 30, takenSince: 9, dosesPerDay: 2, lowDays: 5 })).toEqual({
      units: 21,
      daysLeft: 10,
      low: false,
    });
  });

  it('is low at the threshold', () => {
    expect(stockStatus({ counted: 12, takenSince: 2, dosesPerDay: 2, lowDays: 5 })).toMatchObject({
      daysLeft: 5,
      low: true,
    });
  });

  it('never goes below zero', () => {
    expect(stockStatus({ counted: 3, takenSince: 7, dosesPerDay: 1, lowDays: 5 })).toEqual({
      units: 0,
      daysLeft: 0,
      low: true,
    });
  });

  it('has no days for a medicine without times', () => {
    expect(stockStatus({ counted: 10, takenSince: 0, dosesPerDay: 0, lowDays: 5 })).toEqual({
      units: 10,
      daysLeft: null,
      low: false,
    });
  });
});

describe('lowStockText', () => {
  it('says how many pills and days are left', () => {
    expect(lowStockText({ units: 6, daysLeft: 3, low: true })).toBe('Restam 6 comprimidos, dá para 3 dias.');
    expect(lowStockText({ units: 1, daysLeft: 0, low: true })).toBe('Resta 1 comprimido, não dá para o dia todo.');
    expect(lowStockText({ units: 0, daysLeft: 0, low: true })).toBe('Pelas doses confirmadas, os comprimidos acabaram.');
  });
});
