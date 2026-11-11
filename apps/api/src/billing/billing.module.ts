import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

/** Paid plan with AbacatePay subscriptions. The call gate is PlanGate, used by the voice services. */
@Module({
  imports: [FamilyModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
