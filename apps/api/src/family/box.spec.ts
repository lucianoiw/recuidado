import { describe, expect, it } from 'vitest';
import { medicationBox, shortIngredient, titleCase } from './box.js';

describe('medicationBox', () => {
  it('names a generic by the full substance, nothing under it', () => {
    expect(medicationBox('Losartana potássica', 'Losartana potássica', true)).toEqual({
      title: 'Losartana Potássica',
      substance: null,
      generic: true,
    });
    expect(medicationBox('Dipirona', 'Dipirona monoidratada', true).title).toBe('Dipirona Monoidratada');
    expect(titleCase('cloridrato de metformina')).toBe('Cloridrato de Metformina');
    expect(shortIngredient('Cloridrato de metformina')).toBe('Metformina');
  });

  it('shows the ingredients under a name with no generic', () => {
    expect(medicationBox('Sacubitril valsartana', 'Sacubitril + Valsartana sódica', false)).toEqual({
      title: 'Sacubitril Valsartana',
      substance: 'Sacubitril + Valsartana Sódica',
      generic: false,
    });
  });

  it('keeps a brand name with the ingredients below', () => {
    expect(medicationBox('Entresto', 'Sacubitril + Valsartana sódica', true)).toEqual({
      title: 'Entresto',
      substance: 'Sacubitril + Valsartana Sódica',
      generic: false,
    });
  });
});
