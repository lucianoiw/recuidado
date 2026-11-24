import { describe, expect, it } from 'vitest';
import { demoDose } from './demo.service.js';

const meds = [
  { id: 'entresto', times: ['08:00', '20:00'] },
  { id: 'aas', times: ['12:00'] },
];
const now = new Date('2026-11-24T21:15:30.250Z'); // 18:15 in São Paulo

describe('demoDose', () => {
  it('is the first medicine, due now, by default', () => {
    expect(demoDose(meds, undefined, now)).toEqual({ med: meds[0], scheduledAt: now });
  });

  it('uses the fixed time today and the medicine taken at that time', () => {
    const { med, scheduledAt } = demoDose(meds, '12:00', now);
    expect(med.id).toBe('aas');
    expect(scheduledAt.toISOString()).toBe('2026-11-24T15:00:00.250Z');
  });

  it('falls back to the first medicine when none is taken at that time', () => {
    expect(demoDose(meds, '14:00', now).med.id).toBe('entresto');
  });

  it('never lands on the exact minute of a scheduled dose', () => {
    const { scheduledAt } = demoDose(meds, '12:00', new Date('2026-11-24T21:15:30.000Z'));
    expect(scheduledAt.getMilliseconds()).toBe(1);
  });
});
