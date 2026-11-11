import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module.js';
import { PushModule } from '../push/push.module.js';
import { StockModule } from '../stock/stock.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { DosesController } from './doses.controller.js';
import { DOSES_QUEUE, DosesService } from '@recuidado/core';

@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE }), PushModule, AlertsModule, StockModule, VoiceModule],
  controllers: [DosesController],
  // The queue is consumed by the worker (src/worker), never by the API process.
  providers: [DosesService],
  exports: [DosesService],
})
export class DosesModule {}
