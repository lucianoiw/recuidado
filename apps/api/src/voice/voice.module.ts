import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOSES_QUEUE } from '../doses/doses.queue.js';
import { PushModule } from '../push/push.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceTokenGuard } from './voice-token.guard.js';
import { VoiceCallService } from './voice.service.js';

/** Reminder phone calls through apps/voice. The doses processor calls VoiceCallService.call on 'call' jobs. */
@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE }), PushModule],
  controllers: [VoiceController],
  providers: [VoiceCallService, VoiceTokenGuard],
  exports: [VoiceCallService],
})
export class VoiceModule {}
