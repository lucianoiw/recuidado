import { describe, expect, it } from 'vitest';
import { freeAccessOf } from './family.service.js';

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
