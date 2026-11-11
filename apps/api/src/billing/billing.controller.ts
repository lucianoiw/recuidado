import { Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { FamilyId } from '../auth/auth.context.js';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service.js';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Plan of this family: free or Recuidado Família, price and trial. */
  @Get('family/plan')
  status(@FamilyId() familyId: string | null) {
    return this.billing.status(familyId);
  }

  /** Starts the AbacatePay checkout; the web opens the returned URL. */
  @Post('family/plan/checkout')
  checkout(@FamilyId({ write: true }) familyId: string | null) {
    return this.billing.checkout(familyId);
  }

  @Post('family/plan/cancel')
  @HttpCode(204)
  async cancel(@FamilyId({ write: true }) familyId: string | null) {
    await this.billing.cancel(familyId);
  }

  /** AbacatePay webhook: the secret comes in the X-Webhook-Secret header and in ?webhookSecret=. */
  @Post('billing/webhook')
  @HttpCode(200)
  @SkipThrottle()
  webhook(
    @Headers('x-webhook-secret') header: string | undefined,
    @Query('webhookSecret') query: string | undefined,
    @Body() body: unknown,
  ) {
    return this.billing.webhook(header || query, body);
  }
}
