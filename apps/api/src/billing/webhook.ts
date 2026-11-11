import { z } from 'zod';

// AbacatePay subscription webhooks (docs: /pages/webhooks/events/subscriptions).
// Arrival order is not guaranteed, so the subscription status in the payload decides.

export const webhookBody = z.object({
  event: z.string(),
  devMode: z.boolean().optional(),
  data: z
    .object({
      subscription: z
        .object({ id: z.string(), status: z.string(), createdAt: z.string().optional() })
        .partial({ status: true })
        .optional(),
      checkout: z.object({ id: z.string(), externalId: z.string().nullish() }).optional(),
    })
    .passthrough(),
});

export type WebhookBody = z.infer<typeof webhookBody>;

export interface SubscriptionPatch {
  subscriptionStatus: 'active' | 'cancelled';
  subscriptionId: string;
  subscriptionTrialEndsAt?: Date | null;
}

/** What a webhook changes on the family, or null when it does not touch the plan. */
export function patchFromEvent(body: WebhookBody, trialDays: number): SubscriptionPatch | null {
  const sub = body.data.subscription;
  if (!body.event.startsWith('subscription.') || !sub) return null;
  if (body.event === 'subscription.payment_failed') return null; // AbacatePay retries; it cancels when they run out.
  const cancelled = body.event === 'subscription.cancelled' || sub.status === 'CANCELLED';
  const patch: SubscriptionPatch = { subscriptionStatus: cancelled ? 'cancelled' : 'active', subscriptionId: sub.id };
  if (body.event === 'subscription.trial_started' && trialDays > 0) {
    const start = sub.createdAt ? new Date(sub.createdAt) : new Date();
    patch.subscriptionTrialEndsAt = new Date(start.getTime() + trialDays * 86_400_000);
  }
  if (body.event === 'subscription.renewed' || body.event === 'subscription.completed') {
    patch.subscriptionTrialEndsAt = null;
  }
  return patch;
}
