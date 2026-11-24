import { describe, expect, it } from 'vitest';
import { sameMedicineKey } from './prescriptions.service.js';

describe('sameMedicineKey', () => {
  it('treats case, accents and spaces as the same medicine', () => {
    expect(sameMedicineKey('AAS', '100 mg')).toBe(sameMedicineKey('aas', '100MG'));
    expect(sameMedicineKey('Rosuvastatina cálcica', '20 mg')).toBe(sameMedicineKey('ROSUVASTATINA CALCICA', '20mg'));
  });

  it('keeps another strength as another medicine', () => {
    expect(sameMedicineKey('Entresto', '50 mg')).not.toBe(sameMedicineKey('Entresto', '100 mg'));
  });
});
