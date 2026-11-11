// Small client for the AbacatePay API v2 (https://docs.abacatepay.com). Amounts are in cents.
// Responses come as { data, success, error }.

export const ABACATEPAY_URL = 'https://api.abacatepay.com/v2';
export const PLAN_EXTERNAL_ID = 'recuidado-familia-mensal';

type FetchFn = typeof fetch;

export class AbacatePayError extends Error {}

export interface SubscriptionCheckout {
  id: string;
  url: string;
  status: string;
  devMode: boolean;
}

export class AbacatePay {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.fetchFn(`${ABACATEPAY_URL}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: unknown } | null;
    if (!res.ok || !json || json.error) {
      throw new AbacatePayError(`AbacatePay ${method} ${path} answered ${res.status}: ${JSON.stringify(json?.error ?? json)}`);
    }
    return json.data as T;
  }

  /** The monthly plan product: found by externalId, or created with the given price and trial. */
  async ensurePlanProduct(plan: { name: string; priceCents: number; trialDays: number }): Promise<string> {
    const found = await this.request<{ id: string }[] | { id: string } | null>(
      'GET',
      `/products/list?externalId=${encodeURIComponent(PLAN_EXTERNAL_ID)}`,
    );
    const existing = Array.isArray(found) ? found[0] : found;
    if (existing?.id) return existing.id;
    const created = await this.request<{ id: string }>('POST', '/products/create', {
      externalId: PLAN_EXTERNAL_ID,
      name: plan.name,
      description: 'Ligações de lembrete, de emergência e para a farmácia.',
      price: plan.priceCents,
      currency: 'BRL',
      cycle: 'MONTHLY',
      ...(plan.trialDays > 0 ? { trialDays: plan.trialDays } : {}),
    });
    return created.id;
  }

  /** Hosted checkout of a subscription to one product. The card is the only method with a free trial. */
  createSubscriptionCheckout(input: {
    productId: string;
    externalId: string;
    returnUrl: string;
    completionUrl: string;
  }): Promise<SubscriptionCheckout> {
    return this.request<SubscriptionCheckout>('POST', '/subscriptions/create', {
      items: [{ id: input.productId, quantity: 1 }],
      externalId: input.externalId,
      returnUrl: input.returnUrl,
      completionUrl: input.completionUrl,
      methods: ['CARD'],
      metadata: { familyId: input.externalId },
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.request('POST', '/subscriptions/cancel', { id: subscriptionId });
  }
}
