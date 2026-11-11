import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOSES_QUEUE } from './doses.queue.js';

@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE })],
})
export class DosesModule {}
