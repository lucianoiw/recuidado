import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { BillingService } from './billing.service.js';

const familyIdQuery = z.uuid().nullish();

function familyOf(value: unknown): string | null {
  const result = familyIdQuery.safeParse(value || null);
  if (!result.success) throw new BadRequestException('familyId inválido.');
  return result.data ?? null;
}

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Plan of this family: free or Recuidado Família, price and trial. */
  @Get('family/plan')
  status(@Query('familyId') familyId?: string) {
    return this.billing.status(familyOf(familyId));
  }

  /** Starts the AbacatePay checkout; the web opens the returned URL. */
  @Post('family/plan/checkout')
  checkout(@Query('familyId') familyId?: string) {
    return this.billing.checkout(familyOf(familyId));
  }

  @Post('family/plan/cancel')
  @HttpCode(204)
  async cancel(@Query('familyId') familyId?: string) {
    await this.billing.cancel(familyOf(familyId));
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
