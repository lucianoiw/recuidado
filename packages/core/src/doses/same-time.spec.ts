import { describe, expect, it } from 'vitest';
import { medicationsLabel } from './same-time.js';

describe('medicationsLabel', () => {
  it('names one medicine with its strength', () => {
    expect(medicationsLabel([{ name: 'Entresto', strength: '50 mg' }])).toBe('Entresto 50 mg');
  });

  it('joins medicines taken together', () => {
    expect(
      medicationsLabel([
        { name: 'Entresto', strength: '50 mg' },
        { name: 'Dapagliflozina', strength: '10 mg' },
        { name: 'AAS', strength: null },
      ]),
    ).toBe('Entresto 50 mg, Dapagliflozina 10 mg e AAS');
  });
});
