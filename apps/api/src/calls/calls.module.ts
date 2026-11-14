import { Module } from '@nestjs/common';
import { PharmacyModule } from '../pharmacy/pharmacy.module.js';
import { VoiceTokenGuard } from '../voice/voice-token.guard.js';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';

/** Call logs and recordings for the calls panel. */
@Module({
  imports: [PharmacyModule],
  controllers: [CallsController],
  providers: [CallsService, VoiceTokenGuard],
})
export class CallsModule {}
