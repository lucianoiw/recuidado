import { describe, expect, it } from 'vitest';
import { patchFromEvent, webhookBody } from './webhook.js';

const event = (name: string, status = 'ACTIVE') =>
  webhookBody.parse({
    id: 'log_1',
    event: name,
    devMode: true,
    data: {
      subscription: { id: 'subs_1', status, createdAt: '2026-11-11T12:00:00.000Z' },
      checkout: { id: 'bill_1', externalId: '00000000-0000-4000-8000-000000000001' },
      customer: { id: 'cust_1' },
    },
  });

describe('patchFromEvent', () => {
  it('activates on completed and clears the trial', () => {
    expect(patchFromEvent(event('subscription.completed'), 7)).toEqual({
      subscriptionStatus: 'active',
      subscriptionId: 'subs_1',
      subscriptionTrialEndsAt: null,
    });
  });

  it('activates on trial_started with the trial end', () => {
    expect(patchFromEvent(event('subscription.trial_started'), 7)).toEqual({
      subscriptionStatus: 'active',
      subscriptionId: 'subs_1',
      subscriptionTrialEndsAt: new Date('2026-11-18T12:00:00.000Z'),
    });
  });

  it('cancels on cancelled and on a CANCELLED status', () => {
    expect(patchFromEvent(event('subscription.cancelled', 'CANCELLED'), 7)?.subscriptionStatus).toBe('cancelled');
    expect(patchFromEvent(event('subscription.renewed', 'CANCELLED'), 7)?.subscriptionStatus).toBe('cancelled');
  });

  it('ignores payment_failed and other events', () => {
    expect(patchFromEvent(event('subscription.payment_failed'), 7)).toBeNull();
    expect(patchFromEvent(event('checkout.completed'), 7)).toBeNull();
  });
});
