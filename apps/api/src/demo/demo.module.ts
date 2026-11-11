import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOSES_QUEUE } from '@recuidado/core';
import { FamilyModule } from '../family/family.module.js';
import { DemoController } from './demo.controller.js';
import { DemoService } from './demo.service.js';

/** Producer only: the jobs run in the single doses worker (DosesProcessor). */
@Module({
  imports: [BullModule.registerQueue({ name: DOSES_QUEUE }), FamilyModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
