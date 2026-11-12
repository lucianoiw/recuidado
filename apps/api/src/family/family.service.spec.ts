import { describe, expect, it } from 'vitest';
import { ageOn, maskPhone, freeAccessOf, withFirstContact } from './family.service.js';

describe('freeAccessOf', () => {
  it('says where a medicine is free and flags Alto Custo', () => {
    expect(freeAccessOf('Losartana Potássica', '50 mg')).toMatchObject({
      freeAt: ['farmacia_popular', 'ubs'],
      highCost: false,
      farmaciaPopularRule: null,
      ubsRestricted: null,
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

  it('checks the age rules with her birth date', () => {
    // Dapagliflozina in the Farmácia Popular: 65 or older.
    expect(freeAccessOf('dapagliflozina', '10 mg', null, undefined, { age: 78 }).freeAt).toEqual(['farmacia_popular']);
    expect(freeAccessOf('dapagliflozina', '10 mg', null, undefined, { age: 60 }).freeAt).toEqual([]);
    expect(freeAccessOf('dapagliflozina', '10 mg', null, undefined, {}).freeAt).toEqual(['farmacia_popular']);
    // Entresto: the Alto Custo lists the diseases, the CID codes and the age to start, from Remédio SP.
    const entresto = freeAccessOf('sacubitril + valsartana', '97 mg + 103 mg', 'Entresto');
    expect(entresto.highCostConditions?.[0]).toMatch(/Insuficiência cardíaca/);
    const ceaf = entresto.programs?.find((p) => p.programId === 'ceaf_sp');
    expect(ceaf?.conditionCodes).toEqual(['I500', 'I501', 'I509']);
    expect(ceaf?.rules.map((r) => r.kind)).toEqual(['min_age', 'start_max_age']);
  });
});

describe('ageOn', () => {
  it('counts whole years on the São Paulo date', () => {
    expect(ageOn('1948-03-10', new Date('2026-11-12T12:00:00Z'))).toBe(78);
    expect(ageOn('1948-11-13', new Date('2026-11-12T12:00:00Z'))).toBe(77);
    expect(ageOn(null, new Date())).toBeNull();
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
