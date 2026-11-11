import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOSES_QUEUE } from '../doses/doses.queue.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { StockModule } from '../stock/stock.module.js';
import { PlanGate } from '../billing/plan-gate.js';
import { VoiceController } from './voice.controller.js';
import { VoiceTokenGuard } from './voice-token.guard.js';
import { VoiceCallService } from './voice.service.js';

/** Reminder phone calls through apps/voice. The doses processor calls VoiceCallService.call on 'call' jobs. */
@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE }), AlertsModule, StockModule],
  controllers: [VoiceController],
  providers: [VoiceCallService, VoiceTokenGuard, PlanGate],
  exports: [VoiceCallService],
})
export class VoiceModule {}
