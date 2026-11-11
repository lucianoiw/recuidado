import { confirmPrescriptionBody } from './confirm.schema.js';

const patientId = '6f1c2b8e-7a4d-4c3e-9b1a-2d5e8f0a1b2c';

describe('confirmPrescriptionBody', () => {
  it('accepts confirmed items and normalizes empty text to null', () => {
    const body = confirmPrescriptionBody.parse({
      patientId,
      items: [
        {
          name: 'Losartana potássica',
          activeIngredient: 'losartana potássica',
          strength: '50 mg',
          times: ['08:00', '20:00'],
        },
        { name: 'Dipirona', activeIngredient: '', strength: null, times: [] },
      ],
    });
    expect(body.items[1]).toEqual({
      name: 'Dipirona',
      activeIngredient: null,
      strength: null,
      times: [],
    });
  });

  it.each(['8:00', '24:00', '08h', 'noite'])('rejects time %s', (time) => {
    const result = confirmPrescriptionBody.safeParse({
      patientId,
      items: [{ name: 'X', times: [time] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty list and an invalid patient id', () => {
    expect(
      confirmPrescriptionBody.safeParse({ patientId, items: [] }).success,
    ).toBe(false);
    expect(
      confirmPrescriptionBody.safeParse({
        patientId: 'maria',
        items: [{ name: 'X', times: [] }],
      }).success,
    ).toBe(false);
  });
});
