import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PushModule } from '../push/push.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { DosesController } from './doses.controller.js';
import { DosesProcessor } from './doses.processor.js';
import { DOSES_QUEUE } from './doses.queue.js';
import { DosesService } from './doses.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE }), PushModule, VoiceModule],
  controllers: [DosesController],
  providers: [DosesService, DosesProcessor],
  exports: [DosesService],
})
export class DosesModule {}
