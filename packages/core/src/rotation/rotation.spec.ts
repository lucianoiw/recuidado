import { describe, expect, it } from 'vitest';
import { addMonths, monthsBetween, rotationParticipants, rotationSchedule, rotationTurnText } from './rotation.js';

const at = (d: string) => new Date(`${d}T12:00:00Z`);

describe('rotation', () => {
  it('adds and counts months across the year', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
  });

  it('leaves out excluded caregivers and follows the chosen order', () => {
    const people = [
      { id: 'a', name: 'Ana', rotationOrder: 1, splitExcluded: false, createdAt: at('2026-11-01') },
      { id: 'c', name: 'Carlos', rotationOrder: null, splitExcluded: false, createdAt: at('2026-11-02') },
      { id: 'b', name: 'Bia', rotationOrder: 0, splitExcluded: false, createdAt: at('2026-11-03') },
      { id: 'd', name: 'Davi', rotationOrder: 2, splitExcluded: true, createdAt: at('2026-11-04') },
    ];
    expect(rotationParticipants(people).map((p) => p.name)).toEqual(['Bia', 'Ana', 'Carlos']);
  });

  it('starts with the first one and wraps around', () => {
    const schedule = rotationSchedule(['Ana', 'Carlos'], '2026-11', '2026-12', 3);
    expect(schedule).toEqual([
      { month: '2026-12', member: 'Carlos' },
      { month: '2027-01', member: 'Ana' },
      { month: '2027-02', member: 'Carlos' },
    ]);
    expect(rotationSchedule([], '2026-11', '2026-11', 2)).toEqual([]);
  });

  it('tells whose turn it is and who comes next', () => {
    const text = rotationTurnText({ month: '2026-12', payer: 'Ana', next: 'Carlos', patient: 'Dona Maria' });
    expect(text.title).toBe('Em dezembro, Ana compra os remédios');
    expect(text.body).toContain('Em janeiro, a vez é de Carlos.');
    expect(rotationTurnText({ month: '2026-12', payer: 'Ana', next: 'Ana', patient: 'Dona Maria' }).body).not.toContain(
      'a vez é de',
    );
  });
});
