import { describe, expect, it } from 'vitest';
import { DEMO_FAMILY } from '../family/demo-family.js';
import { mayContact } from './consent.js';

describe('mayContact', () => {
  it('calls only with consent, except the synthetic demo family', () => {
    expect(mayContact(null, 'Família de Maria')).toBe(false);
    expect(mayContact(new Date(), 'Família de Maria')).toBe(true);
    expect(mayContact(null, DEMO_FAMILY)).toBe(true);
  });
});
