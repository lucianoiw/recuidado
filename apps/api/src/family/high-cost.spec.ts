import { highCostGuide } from '@recuidado/data';
import { describe, expect, it } from 'vitest';
import { highCostStatus, todayInSaoPaulo } from './high-cost.js';

const guide = highCostGuide('sacubitril valsartana');

describe('highCostStatus', () => {
  it('counts only items of the current stage', () => {
    const status = highCostStatus({ checked: ['lme', 'echo', 'gone'], lmeFilledOn: null, since: null }, guide, '2026-11-11');
    expect(status.stage).toBe('first');
    expect(status.checked).toEqual(['lme', 'echo']);
    expect(status.done).toBe(2);
    expect(status.total).toBe(guide.firstRequest.length);
    expect(status.due).toBeNull();
  });

  it('gives 90 days to hand in the LME and reminds in the last 30', () => {
    const saved = { checked: [], lmeFilledOn: '2026-09-01', since: null };
    expect(highCostStatus(saved, guide, '2026-09-02').due).toBeNull();
    const status = highCostStatus(saved, guide, '2026-11-11');
    expect(status.lmeDeliverBy).toBe('2026-11-30');
    expect(status.due).toEqual({ kind: 'lme', by: '2026-11-30', daysLeft: 19 });
  });

  it('counts the renewal from the approval and keeps late ones as due', () => {
    const status = highCostStatus({ checked: ['lme'], lmeFilledOn: '2026-02-01', since: '2026-03-31' }, guide, '2026-10-02');
    expect(status.stage).toBe('renewal');
    expect(status.lmeDeliverBy).toBeNull();
    expect(status.renewBy).toBe('2026-09-30');
    expect(status.due).toEqual({ kind: 'renewal', by: '2026-09-30', daysLeft: -2 });
  });

  it('has no renewal date when the leaflet does not say how often', () => {
    const general = highCostGuide('memantina');
    expect(highCostStatus({ checked: [], lmeFilledOn: null, since: '2026-01-10' }, general, '2026-11-11').renewBy).toBeNull();
  });
});

describe('todayInSaoPaulo', () => {
  it('uses the São Paulo day, not UTC', () => {
    expect(todayInSaoPaulo(new Date('2026-11-12T02:00:00Z'))).toBe('2026-11-11');
  });
});
