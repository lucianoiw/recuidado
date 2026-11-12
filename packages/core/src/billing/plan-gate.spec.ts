import { describe, expect, it } from 'vitest';
import { emailList } from './plan-gate.js';

describe('emailList', () => {
  it('trims, lower-cases and drops empty entries', () => {
    expect([...emailList(' Ana@Example.com, ,bia@example.com ')]).toEqual(['ana@example.com', 'bia@example.com']);
  });

  it('is empty without a value', () => {
    expect(emailList(undefined).size).toBe(0);
  });
});
