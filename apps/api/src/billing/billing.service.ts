import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, or } from 'drizzle-orm';
import { type Database, DB, families, telemetry } from '@recuidado/core';
import { FamilyService } from '../family/family.service.js';
import { AbacatePay } from './abacatepay.js';
import { patchFromEvent, webhookBody } from './webhook.js';

export const PLAN_NAME = 'Recuidado Família';

function sameSecret(a: string, b: string): boolean {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  return A.length === B.length && timingSafeEqual(A, B);
}

/** The paid plan: checkout, cancel and the AbacatePay webhook. */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private productId: string | undefined;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly family: FamilyService,
  ) {
    this.productId = this.config.get<string>('ABACATEPAY_PRODUCT_ID');
  }

  private get plan() {
    return {
      name: PLAN_NAME,
      priceCents: this.config.getOrThrow<number>('PLAN_PRICE_CENTS'),
      trialDays: this.config.getOrThrow<number>('PLAN_TRIAL_DAYS'),
    };
  }

  private client(): AbacatePay {
    const key = this.config.get<string>('ABACATEPAY_API_KEY');
    if (!key) throw new ServiceUnavailableException('O plano pago ainda não está disponível.');
    return new AbacatePay(key);
  }

  /** Plan of this family, for the plan screen. */
  async status(familyId: string | null) {
    const ref = await this.family.resolveFamily(familyId);
    const [row] = await this.db
      .select({
        status: families.subscriptionStatus,
        trialEndsAt: families.subscriptionTrialEndsAt,
        updatedAt: families.subscriptionUpdatedAt,
      })
      .from(families)
      .where(eq(families.id, ref.familyId));
    return {
      ...this.plan,
      available: Boolean(this.config.get<string>('ABACATEPAY_API_KEY')),
      isDemo: ref.isDemo,
      status: row?.status ?? null,
      trialEndsAt: row?.trialEndsAt?.toISOString() ?? null,
    };
  }

  /** Opens an AbacatePay subscription checkout for this family and returns its URL. */
  async checkout(familyId: string | null): Promise<{ url: string }> {
    const ref = await this.family.resolveFamily(familyId);
    const client = this.client();
    this.productId ??= await client.ensurePlanProduct(this.plan);
    const web = this.config.getOrThrow<string>('WEB_URL');
    const checkout = await client.createSubscriptionCheckout({
      productId: this.productId,
      externalId: ref.familyId,
      returnUrl: `${web}/family/plano`,
      completionUrl: `${web}/family/plano?pago=1`,
    });
    // An active plan stays active until the webhook of the new checkout arrives.
    const [current] = await this.db
      .select({ status: families.subscriptionStatus })
      .from(families)
      .where(eq(families.id, ref.familyId));
    await this.db
      .update(families)
      .set({
        subscriptionCheckoutId: checkout.id,
        subscriptionStatus: current?.status === 'active' ? 'active' : 'pending',
        subscriptionUpdatedAt: new Date(),
      })
      .where(eq(families.id, ref.familyId));
    telemetry.capture('plan_checkout_started', { demo: ref.isDemo, dev_mode: checkout.devMode }, ref.patientId);
    return { url: checkout.url };
  }

  /** Cancels the subscription now. Calls stop; the family keeps the free plan. */
  async cancel(familyId: string | null): Promise<void> {
    const ref = await this.family.resolveFamily(familyId);
    const [row] = await this.db
      .select({ subscriptionId: families.subscriptionId })
      .from(families)
      .where(eq(families.id, ref.familyId));
    if (row?.subscriptionId) await this.client().cancelSubscription(row.subscriptionId);
    await this.db
      .update(families)
      .set({ subscriptionStatus: 'cancelled', subscriptionTrialEndsAt: null, subscriptionUpdatedAt: new Date() })
      .where(eq(families.id, ref.familyId));
    telemetry.capture('plan_cancelled', { demo: ref.isDemo, by: 'family' }, ref.patientId);
  }

  /** AbacatePay webhook. The secret proves it came from AbacatePay. */
  async webhook(secret: string | undefined, body: unknown): Promise<{ ok: true }> {
    const expected = this.config.get<string>('ABACATEPAY_WEBHOOK_SECRET');
    if (!expected || !secret || !sameSecret(secret, expected)) throw new UnauthorizedException();
    const parsed = webhookBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Webhook inválido.');
    const patch = patchFromEvent(parsed.data, this.plan.trialDays);
    const checkout = parsed.data.data.checkout;
    if (!patch) return { ok: true };

    const matches = [eq(families.subscriptionId, patch.subscriptionId)];
    if (checkout?.id) matches.push(eq(families.subscriptionCheckoutId, checkout.id));
    const updated = await this.db
      .update(families)
      .set({ ...patch, subscriptionUpdatedAt: new Date() })
      .where(or(...matches))
      .returning({ id: families.id });
    if (updated.length === 0 && checkout?.externalId) {
      // Checkout created before its id was saved: the externalId is the family id.
      const byFamily = await this.db
        .update(families)
        .set({ ...patch, subscriptionCheckoutId: checkout.id, subscriptionUpdatedAt: new Date() })
        .where(eq(families.id, checkout.externalId))
        .returning({ id: families.id })
        .catch(() => []);
      updated.push(...byFamily);
    }
    if (updated.length === 0) {
      this.logger.warn(`Webhook ${parsed.data.event} for ${patch.subscriptionId} matched no family.`);
      return { ok: true };
    }
    telemetry.capture('plan_webhook', {
      event: parsed.data.event,
      status: patch.subscriptionStatus,
      dev_mode: parsed.data.devMode ?? null,
    });
    this.logger.log(`Plan of family ${updated[0]!.id}: ${patch.subscriptionStatus} (${parsed.data.event}).`);
    return { ok: true };
  }
}
