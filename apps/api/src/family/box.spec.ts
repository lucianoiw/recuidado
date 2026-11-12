import { describe, expect, it } from 'vitest';
import { medicationBox, shortIngredient } from './box.js';

describe('medicationBox', () => {
  it('names a generic by the short substance', () => {
    expect(medicationBox('Losartana potássica', 'Losartana potássica', true)).toEqual({
      title: 'Losartana',
      substance: 'losartana potássica',
      generic: true,
    });
    expect(medicationBox('Dipirona monoidratada', 'Dipirona monoidratada', true).title).toBe('Dipirona');
    expect(shortIngredient('Cloridrato de metformina')).toBe('Metformina');
  });

  it('capitalizes each substance of a combination', () => {
    const box = medicationBox('Sacubitril valsartana', 'Sacubitril + Valsartana sódica', false);
    expect(box.title).toBe('Sacubitril Valsartana');
    expect(box.substance).toBe('sacubitril + valsartana sódica');
    expect(box.generic).toBe(false);
  });

  it('keeps a brand name', () => {
    expect(medicationBox('Entresto', 'Sacubitril + Valsartana sódica', true)).toEqual({
      title: 'Entresto',
      substance: 'sacubitril + valsartana sódica',
      generic: false,
    });
  });
});
