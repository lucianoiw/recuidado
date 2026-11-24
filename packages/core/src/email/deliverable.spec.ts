import { describe, expect, it } from 'vitest';
import { deliverable } from './email.service.js';

describe('deliverable', () => {
  it('skips reserved example and test domains', () => {
    expect(deliverable('ana@example.com')).toBe(false);
    expect(deliverable('ana@mail.example.org')).toBe(false);
    expect(deliverable('ana@family.test')).toBe(false);
  });

  it('keeps real domains', () => {
    expect(deliverable('carlos@gmail.com')).toBe(true);
    expect(deliverable('ana@myexample.com')).toBe(true);
  });
});
