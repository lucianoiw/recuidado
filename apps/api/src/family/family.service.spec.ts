import { describe, expect, it } from 'vitest';
import { maskPhone, freeAccessOf, withFirstContact } from './family.service.js';

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

describe('withFirstContact', () => {
  const ana = { name: 'Ana', emergencyContact: false, hasPhone: true };
  const carlos = { name: 'Carlos', emergencyContact: false, hasPhone: true };
  const first = (list: { name: string; emergencyContact: boolean }[]) =>
    list.filter((c) => c.emergencyContact).map((c) => c.name);

  it('marks the chosen caregiver only', () => {
    expect(first(withFirstContact([ana, { ...carlos, emergencyContact: true }]))).toEqual(['Carlos']);
  });

  it('falls back to the oldest caregiver with a phone', () => {
    expect(first(withFirstContact([ana, carlos]))).toEqual(['Ana']);
    expect(first(withFirstContact([{ ...ana, hasPhone: false }, carlos]))).toEqual(['Carlos']);
    expect(first(withFirstContact([ana, { ...carlos, emergencyContact: true, hasPhone: false }]))).toEqual(['Ana']);
  });

  it('marks nobody when no one has a phone', () => {
    expect(first(withFirstContact([{ ...ana, hasPhone: false }]))).toEqual([]);
  });
});
