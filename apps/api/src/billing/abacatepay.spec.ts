import { describe, expect, it, vi } from 'vitest';
import { AbacatePay, AbacatePayError, PLAN_EXTERNAL_ID } from './abacatepay.js';

const ok = (data: unknown) => new Response(JSON.stringify({ data, success: true, error: null }), { status: 200 });

describe('AbacatePay', () => {
  it('reuses the plan product found by externalId', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(ok([{ id: 'prod_1' }]));
    const id = await new AbacatePay('key', fetchFn).ensurePlanProduct({ name: 'P', priceCents: 1990, trialDays: 7 });
    expect(id).toBe('prod_1');
    expect(fetchFn.mock.calls[0]![0]).toContain(`/products/list?externalId=${PLAN_EXTERNAL_ID}`);
    expect(fetchFn.mock.calls[0]![1].headers.authorization).toBe('Bearer key');
  });

  it('creates a monthly product with trial when none exists', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok({ id: 'prod_2' }));
    const id = await new AbacatePay('key', fetchFn).ensurePlanProduct({ name: 'P', priceCents: 1990, trialDays: 7 });
    expect(id).toBe('prod_2');
    const body = JSON.parse(fetchFn.mock.calls[1]![1].body);
    expect(body).toMatchObject({ externalId: PLAN_EXTERNAL_ID, price: 1990, cycle: 'MONTHLY', trialDays: 7, currency: 'BRL' });
  });

  it('sends one item and the family as externalId on checkout', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(ok({ id: 'bill_1', url: 'https://pay', status: 'PENDING', devMode: true }));
    const checkout = await new AbacatePay('key', fetchFn).createSubscriptionCheckout({
      productId: 'prod_1',
      externalId: 'fam',
      returnUrl: 'https://w/family/plano',
      completionUrl: 'https://w/family/plano?pago=1',
    });
    expect(checkout.url).toBe('https://pay');
    const body = JSON.parse(fetchFn.mock.calls[0]![1].body);
    expect(body.items).toEqual([{ id: 'prod_1', quantity: 1 }]);
    expect(body.externalId).toBe('fam');
  });

  it('throws on an API error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: null, error: 'Insufficient permissions' }), { status: 401 }));
    await expect(new AbacatePay('key', fetchFn).cancelSubscription('subs_1')).rejects.toBeInstanceOf(AbacatePayError);
  });
});
