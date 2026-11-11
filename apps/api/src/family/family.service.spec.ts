import { describe, expect, it } from 'vitest';
import { maskPhone, freeAccessOf } from './family.service.js';

describe('freeAccessOf', () => {
  it('says where a medicine is free and flags Alto Custo', () => {
    expect(freeAccessOf('Losartana Potássica', '50 mg')).toEqual({
      freeAt: ['farmacia_popular', 'ubs'],
      highCost: false,
    });
    expect(freeAccessOf('atorvastatina', '20 mg')).toEqual({ freeAt: [], highCost: true });
    expect(freeAccessOf('vitamina inventada', '1 mg')).toEqual({ freeAt: [], highCost: false });
  });
});

describe('maskPhone', () => {
  it('keeps only the area code and the last 4 digits', () => {
    expect(maskPhone('11987654321')).toBe('(11) •••••-4321');
    expect(maskPhone('+55 (11) 98765-4321')).toBe('(11) •••••-4321');
  });

  it('returns null without a phone', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('')).toBeNull();
  });
});
