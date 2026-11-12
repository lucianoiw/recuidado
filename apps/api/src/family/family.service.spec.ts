import { describe, expect, it } from 'vitest';
import { maskPhone, freeAccessOf, withFirstContact } from './family.service.js';

describe('freeAccessOf', () => {
  it('says where a medicine is free and flags Alto Custo', () => {
    expect(freeAccessOf('Losartana Potássica', '50 mg')).toEqual({
      freeAt: ['farmacia_popular', 'ubs'],
      highCost: false,
      farmaciaPopularRule: null,
    });
    expect(freeAccessOf('atorvastatina', '20 mg')).toMatchObject({ freeAt: [], highCost: true });
    expect(freeAccessOf('vitamina inventada', '1 mg')).toMatchObject({ freeAt: [], highCost: false });
  });

  it('sends each medicine where it really is free (Luciano, 12/11)', () => {
    // Plain metformina is at the UBS; the XR one only at the Farmácia Popular.
    expect(freeAccessOf('cloridrato de metformina', '500 mg', 'Metformina').freeAt).toEqual(['farmacia_popular', 'ubs']);
    expect(freeAccessOf('cloridrato de metformina', '500 mg', 'Metformina XR').freeAt).toEqual(['farmacia_popular']);
    expect(freeAccessOf('ácido acetilsalicílico', '100 mg', 'AAS').freeAt).toEqual(['ubs']);
    expect(freeAccessOf('espironolactona', '25 mg').freeAt).toEqual(['farmacia_popular', 'ubs']);
    const dapa = freeAccessOf('dapagliflozina', '10 mg');
    expect(dapa.freeAt).toEqual(['farmacia_popular']);
    expect(dapa.farmaciaPopularRule).toContain('65 anos');
    // Entresto: Alto Custo with LME, however the prescription writes the combo.
    expect(freeAccessOf('sacubitril + valsartana', '50 mg', 'Entresto')).toMatchObject({ freeAt: [], highCost: true });
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
