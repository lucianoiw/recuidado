import { Module } from '@nestjs/common';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';

/** Call logs and recordings for the calls panel. */
@Module({
  controllers: [CallsController],
  providers: [CallsService, VoiceTokenGuard],
})
export class CallsModule {}
