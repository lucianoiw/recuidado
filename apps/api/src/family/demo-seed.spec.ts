import { DEMO_MEDICATIONS, demoHistory, HISTORY_DAYS } from './demo-seed.js';

describe('demoHistory', () => {
  // 15:00 in São Paulo.
  const now = new Date('2026-11-12T18:00:00Z');

  it('fills the past days and the doses of today that already passed', () => {
    const history = demoHistory(now);
    const perDay = DEMO_MEDICATIONS.reduce((n, m) => n + m.times.length, 0);
    // Today: only the two 08:00 doses passed.
    expect(history).toHaveLength(HISTORY_DAYS * perDay + 2);
    expect(history.every((h) => h.scheduledAt.getTime() < now.getTime())).toBe(true);
  });

  it('has one missed dose with the family alerted and two voice confirmations', () => {
    const history = demoHistory(now);
    const missed = history.filter((h) => h.status === 'missed');
    expect(missed).toHaveLength(1);
    expect(missed[0]!.familyAlertedAt).not.toBeNull();
    expect(history.filter((h) => h.confirmedVia === 'voice')).toHaveLength(2);
  });

  it('is the same on every boot of the same day', () => {
    expect(demoHistory(now)).toEqual(demoHistory(new Date(now.getTime())));
  });

  it('gives every medicine an ingredient, a strength and times (the price comes from them)', () => {
    expect(DEMO_MEDICATIONS).toHaveLength(3);
    expect(DEMO_MEDICATIONS.every((m) => m.activeIngredient && m.strength && m.times.length > 0)).toBe(true);
  });
});
